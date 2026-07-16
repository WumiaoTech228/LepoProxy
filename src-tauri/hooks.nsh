!macro NSIS_HOOK_POSTINSTALL
    WriteINIStr "$INSTDIR\desktop.ini" ".ShellClassInfo" "IconResource" "LepoProxy.exe,0"
    SetFileAttributes "$INSTDIR\desktop.ini" HIDDEN|SYSTEM
    SetFileAttributes "$INSTDIR" READONLY
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    SetFileAttributes "$INSTDIR\desktop.ini" NORMAL
    Delete "$INSTDIR\desktop.ini"
!macroend
