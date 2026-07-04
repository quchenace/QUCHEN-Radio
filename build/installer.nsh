!ifndef MUI_BGCOLOR
  !define MUI_BGCOLOR "FFFFFF"
!endif
!ifndef MUI_TEXTCOLOR
  !define MUI_TEXTCOLOR "111217"
!endif
!ifndef MUI_DIRECTORYPAGE_BGCOLOR
  !define MUI_DIRECTORYPAGE_BGCOLOR "FFFFFF"
!endif
!ifndef MUI_DIRECTORYPAGE_TEXTCOLOR
  !define MUI_DIRECTORYPAGE_TEXTCOLOR "111217"
!endif
!ifndef MUI_INSTFILESPAGE_COLORS
  !define MUI_INSTFILESPAGE_COLORS "3257F7 FFFFFF"
!endif
!ifndef MUI_FINISHPAGE_LINK_COLOR
  !define MUI_FINISHPAGE_LINK_COLOR "3257F7"
!endif
!ifndef MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE
!endif
!ifndef MUI_HEADERIMAGE_BITMAP_STRETCH
  !define MUI_HEADERIMAGE_BITMAP_STRETCH "FitControl"
!endif
!ifndef MUI_HEADERIMAGE_UNBITMAP_STRETCH
  !define MUI_HEADERIMAGE_UNBITMAP_STRETCH "FitControl"
!endif
!ifndef BUILD_UNINSTALLER
  !ifndef MUI_CUSTOMFUNCTION_GUIINIT
    !define MUI_CUSTOMFUNCTION_GUIINIT QuchenRadioGuiInit
  !endif
!endif

!include LogicLib.nsh
!include FileFunc.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

!define QUCHEN_INSTALL_MARKER ".quchen-install-root"

!ifndef BUILD_UNINSTALLER
  Var QuchenRadioWelcomePage
  Var QuchenRadioHeroFont
  Var QuchenRadioTitleFont
  Var QuchenRadioBodyFont
  Var QuchenRadioSmallFont
  Var QuchenRadioDirectoryPage
  Var QuchenRadioDirectoryInput
!endif

!macro customInit
  !ifndef BUILD_UNINSTALLER
    Call QuchenRadioUsePreferredInstallDir
  !endif
!macroend

!macro customInstall
  Call QuchenRadioWriteInstallMarker
!macroend

!macro customUnInit
  Call un.QuchenRadioAbortUnsafeUninstallRoot
!macroend

!macro customWelcomePage
  Page custom QuchenRadioWelcomeShow
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  Page custom QuchenRadioDirectoryShow QuchenRadioDirectoryLeave
!macroend

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function QuchenRadioFinishStartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "QuchenRadioFinishStartApp"
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW QuchenRadioTintCommonControls
  !insertmacro MUI_PAGE_FINISH
!macroend

!ifndef BUILD_UNINSTALLER
Function QuchenRadioGuiInit
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4) i .r0'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 19, *i 1, i 4) i .r0'
  Call QuchenRadioTintCommonControls
FunctionEnd

Function QuchenRadioTintCommonControls
  SetCtlColors $HWNDPARENT "111217" "FFFFFF"

  GetDlgItem $0 $HWNDPARENT 1
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 2
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 3
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1028
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1256
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1034
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1035
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1037
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1038
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1039
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}

  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"

    GetDlgItem $1 $0 1000
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1001
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1004
    ${If} $1 <> 0
      SetCtlColors $1 "3257F7" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1006
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1016
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1019
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1020
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1023
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1024
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1027
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1201
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1202
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1203
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1204
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function QuchenRadioUsePreferredInstallDir
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/D=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    Push "$R1"
    Call QuchenRadioNormalizeInstallDir
    Pop $INSTDIR
  ${Else}
    StrCpy $INSTDIR "C:\Quchen-Radio"
  ${EndIf}
FunctionEnd

Function QuchenRadioNormalizeInstallDir
  Exch $0
  ${If} $0 == ""
    StrCpy $0 "C:\Quchen-Radio"
    Exch $0
    Return
  ${EndIf}

  StrCpy $4 "$0" 1 -1
  ${If} $4 == "\"
    StrCpy $0 "$0" -1
  ${EndIf}

  StrLen $1 "$0"
  ${If} $1 == 2
    StrCpy $2 "$0" 1 1
    ${If} $2 == ":"
      StrCpy $0 "$0\Quchen-Radio"
    ${EndIf}
  ${ElseIf} $1 == 3
    StrCpy $2 "$0" 1 1
    StrCpy $3 "$0" 1 2
    ${If} $2 == ":"
    ${AndIf} $3 == "\"
      StrCpy $0 "$0Quchen-Radio"
    ${EndIf}
  ${Else}
    ${GetFileName} "$0" $2
    ${If} $2 != "Quchen-Radio"
    ${AndIf} $2 != "quchen-radio"
      StrCpy $0 "$0\Quchen-Radio"
    ${EndIf}
  ${EndIf}
  Exch $0
FunctionEnd

Function QuchenRadioWriteInstallMarker
  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $0 "$INSTDIR\${QUCHEN_INSTALL_MARKER}" w
  ${If} ${Errors}
    MessageBox MB_ICONSTOP|MB_OK "无法写入安装目录安全标记，安装已停止。请选择可写入的 Quchen Radio 专用文件夹。"
    Abort
  ${EndIf}
  FileWrite $0 "Quchen Radio install root marker.$\r$\n"
  FileClose $0
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.QuchenRadioAbortUnsafeUninstallRoot
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "Quchen-Radio"
  ${AndIf} $0 != "quchen-radio"
    MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 Quchen Radio 专用安装目录。为避免误删用户文件，请手动删除 Quchen Radio 程序文件。"
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\${QUCHEN_INSTALL_MARKER}" safe 0
  MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 Quchen Radio 专用安装目录，缺少安全标记 ${QUCHEN_INSTALL_MARKER}。为避免误删用户文件，请手动删除 Quchen Radio 程序文件。"
  Abort
safe:
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function QuchenRadioWelcomeShow
  Call QuchenRadioUsePreferredInstallDir

  nsDialogs::Create 1018
  Pop $QuchenRadioWelcomePage
  ${If} $QuchenRadioWelcomePage == error
    Abort
  ${EndIf}

  SetCtlColors $QuchenRadioWelcomePage "111217" "FFFFFF"
  CreateFont $QuchenRadioHeroFont "Microsoft YaHei UI" 24 700
  CreateFont $QuchenRadioTitleFont "Microsoft YaHei UI" 11 700
  CreateFont $QuchenRadioBodyFont "Microsoft YaHei UI" 9 400
  CreateFont $QuchenRadioSmallFont "Microsoft YaHei UI" 8 400

  ${NSD_CreateLabel} 22u 20u 82u 10u "QUCHEN"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioSmallFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  ${NSD_CreateLabel} 22u 42u 226u 30u "Quchen Radio 安装"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioHeroFont 1
  SetCtlColors $0 "111217" "FFFFFF"

  ${NSD_CreateLabel} 22u 78u 36u 2u ""
  Pop $0
  SetCtlColors $0 "" "3257F7"

  ${NSD_CreateLabel} 22u 96u 238u 24u "为这台电脑安装 Quchen Radio。默认安装到 C:\Quchen-Radio；选择其它位置时会自动落入专用 Quchen Radio 子文件夹。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioBodyFont 1
  SetCtlColors $0 "4B5263" "FFFFFF"

  ${NSD_CreateLabel} 22u 130u 238u 12u "默认位置：$INSTDIR"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioTitleFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  nsDialogs::Show
FunctionEnd

Function QuchenRadioDirectoryBrowse
  nsDialogs::SelectFolderDialog "选择 Quchen Radio 安装文件夹" "$INSTDIR"
  Pop $0
  ${If} $0 != error
  ${AndIf} $0 != ""
    Push "$0"
    Call QuchenRadioNormalizeInstallDir
    Pop $0
    StrCpy $INSTDIR "$0"
    SendMessage $QuchenRadioDirectoryInput ${WM_SETTEXT} 0 "STR:$INSTDIR"
  ${EndIf}
FunctionEnd

Function QuchenRadioDirectoryShow
  Call QuchenRadioUsePreferredInstallDir

  nsDialogs::Create 1018
  Pop $QuchenRadioDirectoryPage
  ${If} $QuchenRadioDirectoryPage == error
    Abort
  ${EndIf}

  SetCtlColors $QuchenRadioDirectoryPage "111217" "FFFFFF"
  CreateFont $QuchenRadioTitleFont "Microsoft YaHei UI" 15 700
  CreateFont $QuchenRadioBodyFont "Microsoft YaHei UI" 9 400
  CreateFont $QuchenRadioSmallFont "Microsoft YaHei UI" 8 500

  ${NSD_CreateLabel} 22u 12u 238u 20u "选择安装位置"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioTitleFont 1
  SetCtlColors $0 "111217" "FFFFFF"

  ${NSD_CreateLabel} 22u 40u 238u 24u "你可以使用默认路径，也可以选择其它磁盘或文件夹。安装器会自动创建专用 Quchen Radio 子目录，避免卸载时影响其它文件。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioBodyFont 1
  SetCtlColors $0 "4B5263" "FFFFFF"

  ${NSD_CreateLabel} 22u 76u 238u 10u "安装目录"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioSmallFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  ${NSD_CreateText} 22u 94u 178u 15u "$INSTDIR"
  Pop $QuchenRadioDirectoryInput
  SendMessage $QuchenRadioDirectoryInput ${WM_SETFONT} $QuchenRadioBodyFont 1
  SetCtlColors $QuchenRadioDirectoryInput "111217" "FFFFFF"

  ${NSD_CreateBrowseButton} 210u 93u 50u 17u "浏览..."
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioSmallFont 1
  ${NSD_OnClick} $0 QuchenRadioDirectoryBrowse

  ${NSD_CreateLabel} 22u 122u 238u 12u "默认推荐：C:\Quchen-Radio；选择现有文件夹会自动追加 Quchen Radio。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $QuchenRadioSmallFont 1
  SetCtlColors $0 "6B7280" "FFFFFF"

  nsDialogs::Show
FunctionEnd

Function QuchenRadioDirectoryLeave
  ${NSD_GetText} $QuchenRadioDirectoryInput $0
  ${If} $0 == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "请选择安装文件夹。"
    Abort
  ${EndIf}
  Push "$0"
  Call QuchenRadioNormalizeInstallDir
  Pop $0
  StrCpy $INSTDIR "$0"
  SendMessage $QuchenRadioDirectoryInput ${WM_SETTEXT} 0 "STR:$INSTDIR"
FunctionEnd
!endif
