$ErrorActionPreference = "Stop"
$port = 3306

function Test-MySqlPort {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne(750, $false)) {
      return $false
    }
    $client.EndConnect($connection)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (Test-MySqlPort) {
  Write-Output "MySQL is already listening on port $port."
  exit 0
}

$service = Get-Service -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "mysql|maria" -or $_.DisplayName -match "mysql|maria" } |
  Select-Object -First 1

if ($service -and $service.Status -ne "Running") {
  try {
    Start-Service -Name $service.Name
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
      Start-Sleep -Seconds 1
      if (Test-MySqlPort) {
        Write-Output "Started MySQL service '$($service.Name)'."
        exit 0
      }
    }
  } catch {
    Write-Warning "Could not start the MySQL service; trying the local user data directory."
  }
}

$baseDirectory = Join-Path $env:ProgramFiles "MySQL\MySQL Server 8.4"
$serverPath = Join-Path $baseDirectory "bin\mysqld.exe"
$dataDirectory = Join-Path $env:USERPROFILE "BorrowLoopMySQLData"

if (-not (Test-Path $serverPath)) {
  throw "MySQL Server was not found at '$serverPath'. Install MySQL 8.4 or update scripts/start-mysql.ps1."
}
if (-not (Test-Path (Join-Path $dataDirectory "mysql"))) {
  throw "MySQL data is not initialized at '$dataDirectory'. Configure MySQL Server and start its Windows service."
}

$arguments = '--basedir="' + $baseDirectory + '" --datadir="' + $dataDirectory +
  '" --port=' + $port + ' --bind-address=127.0.0.1 --mysqlx=0 --console'
$process = Start-Process -FilePath $serverPath -ArgumentList $arguments -PassThru -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Seconds 1
  if (Test-MySqlPort) {
    Write-Output "Started local MySQL (process $($process.Id)) on port $port."
    exit 0
  }
  if ($process.HasExited) {
    throw "MySQL stopped during startup. Check its data directory and server configuration."
  }
}

throw "MySQL did not start listening on port $port."
