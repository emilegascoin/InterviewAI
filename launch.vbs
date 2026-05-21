Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\InterviewAI"
WshShell.Run "cmd /c start.bat", 0, False
