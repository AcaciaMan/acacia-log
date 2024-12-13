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
