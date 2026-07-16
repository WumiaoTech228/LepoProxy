!macro NSIS_HOOK_PREINSTALL
    ; Check if the application is already installed in registry (HKCU or HKLM)
    ; We use register $R0 to store the UninstallString
    
    ; 1. Check HKCU (Per-user install)
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"
    StrCmp $R0 "" check_hklm
    Goto found_previous

check_hklm:
    ; 2. Check HKLM (All-users install)
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"
    StrCmp $R0 "" no_previous

found_previous:
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到先前版本的 ${PRODUCT_NAME} 已经安装在您的系统中。$\r$\n$\r$\n点击“确定”将自动为您卸载已存在的旧版本，然后继续安装；$\r$\n点击“取消”将终止本次安装。" IDOK uninstall IDCANCEL abort_install

uninstall:
    DetailPrint "正在自动卸载旧版本以防止冲突..."
    
    ; Execute uninstaller silently
    ExecWait '$R0 /S' $0
    
    ; Sleep for a short time to ensure files are released
    Sleep 1000
    Goto no_previous

abort_install:
    Abort "由于检测到先前版本且用户取消了卸载，安装程序已终止。"

no_previous:
!macroend

!macro NSIS_HOOK_POSTINSTALL
    WriteINIStr "$INSTDIR\desktop.ini" ".ShellClassInfo" "IconResource" "LepoProxy.exe,0"
    SetFileAttributes "$INSTDIR\desktop.ini" HIDDEN|SYSTEM
    SetFileAttributes "$INSTDIR" READONLY
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    SetFileAttributes "$INSTDIR\desktop.ini" NORMAL
    Delete "$INSTDIR\desktop.ini"
!macroend
