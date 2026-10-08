@echo off
REM ==============================================================================
REM EMWTS PostgreSQL Database Restore Script (Windows)
REM ==============================================================================
setlocal enabledelayedexpansion

if "%~1"=="" (
    echo [!] Usage: restore_db.bat ^<path_to_backup_dump_file^>
    echo [!] Example: restore_db.bat ..\backups\emwts_db_20261008_120000.dump
    exit /b 1
)

set BACKUP_FILE=%~1
if not exist "%BACKUP_FILE%" (
    echo [!] ERROR: Backup file not found: %BACKUP_FILE%
    exit /b 1
)

if exist "..\backend\.env" (
    for /f "usebackq tokens=1,* delims==" %%i in ("..\backend\.env") do (
        if not "%%i"=="" set "%%i=%%j"
    )
)

if "%DB_NAME%"=="" set DB_NAME=emwts_db
if "%DB_USER%"=="" set DB_USER=emwts_user
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=5432
if "%PGPASSWORD%"=="" set PGPASSWORD=%DB_PASSWORD%

echo [!] WARNING: This will restore database '%DB_NAME%' from '%BACKUP_FILE%'.
echo [!] Target host: %DB_HOST%:%DB_PORT%, User: %DB_USER%
set /p CONFIRM="Type 'YES' to proceed: "
if not "%CONFIRM%"=="YES" (
    echo [*] Restore cancelled by user.
    exit /b 0
)

echo [*] Terminating active connections and restoring schema/data...
pg_restore -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists -v "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [+] Database restored successfully from %BACKUP_FILE%
) else (
    echo [!] Warning or non-zero return during pg_restore (exit code %ERRORLEVEL%). Check messages above.
)
endlocal
