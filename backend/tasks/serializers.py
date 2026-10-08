from rest_framework import serializers
from .models import Task, TaskComment, TaskHistory, TaskPriority, TaskStatus


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            "id",
            "task",
            "author",
            "author_name",
            "author_email",
            "content",
            "created_at",
        ]
        read_only_fields = ["id", "task", "author", "created_at"]



class TaskHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)

    class Meta:
        model = TaskHistory
        fields = [
            "id",
            "task",
            "changed_by",
            "changed_by_name",
            "field_name",
            "old_value",
            "new_value",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TaskListSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True, default="Unassigned")
    assignee_id_code = serializers.CharField(source="assignee.employee_id", read_only=True, default="")
    assignee_photo = serializers.ImageField(source="assignee.profile_photo", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    assigning_manager_name = serializers.CharField(source="assigning_manager.full_name", read_only=True, default="")
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "task_id",
            "title",
            "priority",
            "status",
            "progress",
            "start_date",
            "due_date",
            "is_overdue",
            "assignee",
            "assignee_name",
            "assignee_id_code",
            "assignee_photo",
            "assigning_manager",
            "assigning_manager_name",
            "department",
            "department_name",
            "estimated_hours",
            "actual_hours",
            "is_archived",
            "created_at",
            "updated_at",
        ]


class TaskDetailSerializer(TaskListSerializer):
    comments = TaskCommentSerializer(many=True, read_only=True)
    history = TaskHistorySerializer(many=True, read_only=True)

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["description", "comments", "history"]


class TaskCreateSerializer(serializers.ModelSerializer):
    task_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "task_id",

            "title",
            "description",
            "assignee",
            "department",
            "priority",
            "start_date",
            "due_date",
            "status",
            "progress",
            "estimated_hours",
            "actual_hours",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_date")
        due = attrs.get("due_date")
        if start and due and due < start:
            raise serializers.ValidationError({"due_date": "Due date cannot be earlier than start date."})

        progress = attrs.get("progress", 0)
        if progress < 0 or progress > 100:
            raise serializers.ValidationError({"progress": "Progress must be between 0 and 100."})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user:
            validated_data["assigning_manager"] = request.user

        if not validated_data.get("task_id"):
            import random
            validated_data["task_id"] = f"TSK-{random.randint(100, 999)}"

        # If assignee specified and no department set, auto-link assignee's department
        assignee = validated_data.get("assignee")
        if assignee and not validated_data.get("department") and assignee.department:
            validated_data["department"] = assignee.department

        task = super().create(validated_data)

        # Log initial creation in history
        TaskHistory.objects.create(
            task=task,
            changed_by=request.user if request else None,
            field_name="creation",
            new_value=f"Task created with status '{task.status}' and priority '{task.priority}'",
        )
        return task


class TaskUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "task_id",
            "title",
            "description",
            "assignee",
            "department",
            "priority",
            "start_date",
            "due_date",
            "status",
            "progress",
            "estimated_hours",
            "actual_hours",
            "is_archived",
        ]
        read_only_fields = ["id", "task_id"]

    def validate(self, attrs):
        start = attrs.get("start_date", self.instance.start_date if self.instance else None)
        due = attrs.get("due_date", self.instance.due_date if self.instance else None)
        if start and due and due < start:
            raise serializers.ValidationError({"due_date": "Due date cannot be earlier than start date."})

        progress = attrs.get("progress")
        if progress is not None and (progress < 0 or progress > 100):
            raise serializers.ValidationError({"progress": "Progress must be between 0 and 100."})

        # Permission check: If current user is ONLY assignee and not manager/admin,
        # they can only update status, progress, and actual_hours.
        request = self.context.get("request")
        if request and request.user:
            u = request.user
            is_admin_or_mgr = u.is_super_admin or u.is_hr_admin or u.is_manager
            if not is_admin_or_mgr:
                restricted_fields = ["title", "description", "assignee", "department", "priority", "start_date", "due_date", "estimated_hours", "is_archived"]
                for f in restricted_fields:
                    if f in attrs and attrs[f] != getattr(self.instance, f):
                        raise serializers.ValidationError({f: "Employees are not authorized to modify administrative task properties."})

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if (request and request.user) else None

        # Track changes for audit history
        changes = []
        for field, new_val in validated_data.items():
            old_val = getattr(instance, field)
            if old_val != new_val:
                changes.append((field, str(old_val), str(new_val)))

        # If status moved to COMPLETED and progress not explicitly updated, auto set progress=100
        if validated_data.get("status") == TaskStatus.COMPLETED and "progress" not in validated_data:
            validated_data["progress"] = 100

        task = super().update(instance, validated_data)

        # Record changes in TaskHistory
        for field_name, old_v, new_v in changes:
            TaskHistory.objects.create(
                task=task,
                changed_by=user,
                field_name=field_name,
                old_value=old_v,
                new_value=new_v,
            )

        return task
