@echo off
REM ==============================================================================
REM EMWTS Automated PostgreSQL Database Backup Script (Windows)
REM ==============================================================================
setlocal enabledelayedexpansion

REM Load environment variables if available
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

set BACKUP_DIR=..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

set BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TIMESTAMP%.dump

echo [*] Starting backup of %DB_NAME% at %DATE% %TIME%...
echo [*] Target host: %DB_HOST%:%DB_PORT%, User: %DB_USER%

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F c -b -v -f "%BACKUP_FILE%" %DB_NAME%

if %ERRORLEVEL% EQU 0 (
    echo [+] Backup completed successfully: %BACKUP_FILE%
    for %%A in ("%BACKUP_FILE%") do echo [+] Backup size: %%~zA bytes
) else (
    echo [!] ERROR: pg_dump backup failed with exit code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

REM Purge backups older than 14 days
echo [*] Cleaning up local backups older than 14 days...
forfiles /p "%BACKUP_DIR%" /m *.dump /d -14 /c "cmd /c del @path" 2>nul
echo [*] Backup procedure finished.
endlocal
