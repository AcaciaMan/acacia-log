Short introduction video:
https://github.com/user-attachments/assets/1d55ac15-f1cf-4fa5-b95f-dac1eb5614d0

Added Pie Bar drawing:

![Screenshot 2025-02-03 045749](https://github.com/user-attachments/assets/a2d28974-9f11-436e-a1d3-2703b702038a)

Added patterns search in log file:

![Screenshot 2025-02-02 063654](https://github.com/user-attachments/assets/dc92f595-09ec-426c-9c4a-2b20267c18c4)


Added command calls through activity bar:

![Screenshot 2025-02-01 151004](https://github.com/user-attachments/assets/a13cf7f0-a801-4ccc-a39b-ca9e8881db8f)

Added VSCode extension with Acacia Log commands:

![Extension Screenshot](https://github.com/user-attachments/assets/f9987ce4-6f63-4fe8-bafe-9d2c1738caef)




Extract date interval log records, find longest time operations, remove dates to compare intervals with WinMerge

AcaciaLog.jar execution example from Windows Powershell.

````
PS C:\Users\User> java -jar "C:\Work\log\Project\AcaciaLog\dist\AcaciaLog.jar"
                       -verbose -li -from 2015-02-08T11:52:02.310Z -to 2015-02-08T11:52:02.311Z
verbose mode on
Option l listLastFiles
Option i printIntervalRows
-from = 2015-02-08T11:52:02.310Z
-to = 2015-02-08T11:52:02.311Z
Success!
[wu] 2015-02-11 14:02:01.103 WindowsUpdate.log C:\Windows

[wu] WindowsUpdate.log
2015-02-08      11:52:02:310     596    1514    DnldMgr Fetching dynamic data from service 117CAB2D-82B1-4B5A-A08...
2015-02-08      11:52:02:310     596    ffc     DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
2015-02-08      11:52:02:310     596    1514    IdleTmr WU operation (CDynamicDownloadDataFetcher::FetchAndStoreD...
2015-02-08      11:52:02:310     596    ffc     DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
2015-02-08      11:52:02:310     596    ffc     DnldMgr Caller SID for retrying failed download job: S-1-5-18
2015-02-08      11:52:02:310     596    1514    EP      Got 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 redir SecuredCli...
2015-02-08      11:52:02:310     596    1514    EP      Got service 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 plugin S...

PS C:\Users\User>
````

Added `-include, -exclude, -o [-top n] (findLogestOperations)`
Include and Exclude sections from acacialog.ini file.
Find longest time taken top (default 10) operations, log records.

Added -r removeDates to compare intervals with WinMerge

acacialog.py execution example from the command line.

````
$ python3 Source/AcaciaLog/acacialog.py -verbose -li -from 2015-02-08T11:52:02.310Z -to 2015-02-08T11:52:02.311Z
verbose mode on
Option l listLastFiles
Option i printIntervalRows
-from = 2015-02-08T11:52:02.310Z
-to = 2015-02-08T11:52:02.311Z
Success!
[wu] 2015-02-11 14:02:01.103 WindowsUpdate.log C:\Windows

[wu] WindowsUpdate.log
2015-02-08      11:52:02:310     596    1514    DnldMgr Fetching dynamic data from service 117CAB2D-82B1-4B5A-A08...
2015-02-08      11:52:02:310     596    ffc     DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
2015-02-08      11:52:02:310     596    1514    IdleTmr WU operation (CDynamicDownloadDataFetcher::FetchAndStoreD...
2015-02-08      11:52:02:310     596    ffc     DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
2015-02-08      11:52:02:310     596    ffc     DnldMgr Caller SID for retrying failed download job: S-1-5-18
2015-02-08      11:52:02:310     596    1514    EP      Got 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 redir SecuredCli...
2015-02-08      11:52:02:310     596    1514    EP      Got service 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 plugin S...

$ 
````

Added `-include, -exclude, -o [-top n] (findLogestOperations)`
Include and Exclude sections from acacialog.ini file.
Find longest time taken top (default 10) operations, log records.

Added -r removeDates to compare intervals with WinMerge

Example log file content:

````
[wu] 2015-02-08 11:52:02.310 596 1514 DnldMgr Fetching dynamic data from service 117CAB2D-82B1-4B5A-A08...
[wu] 2015-02-08 11:52:02.310 596 ffc DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
[wu] 2015-02-08 11:52:02.310 596 1514 IdleTmr WU operation (CDynamicDownloadDataFetcher::FetchAndStoreD...
[wu] 2015-02-08 11:52:02.310 596 ffc DnldMgr 403'd BITS job {6171D9FD-EFD1-4A70-B17B-F4CEF266B148}, up...
[wu] 2015-02-08 11:52:02.310 596 ffc DnldMgr Caller SID for retrying failed download job: S-1-5-18
[wu] 2015-02-08 11:52:02.310 596 1514 EP Got 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 redir SecuredCli...
[wu] 2015-02-08 11:52:02.310 596 1514 EP Got service 117CAB2D-82B1-4B5A-A08C-4D62DBEE7782 plugin S...
````

## JSON Configuration File

The `acacialog.py` script now supports reading configuration from a JSON file. The JSON configuration file should be named `Source/AcaciaLog/acacialog.json` and should have the following structure:

```json
{
  "wu": {
    "DIR": "C:\\Windows",
    "FILE": "WindowsUpdate.log",
    "DATE": "(?m)^(\d{4})-(\d{2})-(\d{2})\t(\d{2}):(\d{2}):(\d{2}):(\d{3})\t",
    "ZONED_DATE_TIME": "g1-g2-g3Tg4:g5:g6.g7Z"
  },
  "cbs": {
    "DIR": "C:\\Windows\\Logs\\CBS",
    "FILE": "cbs.log",
    "DATE": "(?m)^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}), ",
    "ZONED_DATE_TIME": "g1-g2-g3Tg4:g5:g6.000Z"
  }
}
```

The JSON configuration file should contain the same configuration parameters as the INI and properties files. Command line arguments can be used to override the configuration parameters specified in the JSON file.
