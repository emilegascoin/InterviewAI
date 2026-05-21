Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\InterviewAI"
WshShell.Run "cmd /c stop.bat", 0, True
