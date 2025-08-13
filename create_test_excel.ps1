# Create test Excel file for findings upload
try {
    # Create Excel COM object
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $workbook = $excel.Workbooks.Add()
    $worksheet = $workbook.Worksheets.Item(1)

    # Add headers
    $headers = @(
        "Title", "Details", "Impact", "Likelihood", "Exposure", "Owner", 
        "Domain", "Business Unit", "Business Owner", "Asset", 
        "Technical Control", "Assigned To", "SLA Date"
    )

    for ($i = 0; $i -lt $headers.Count; $i++) {
        $worksheet.Cells.Item(1, $i + 1) = $headers[$i]
    }

    # Add test data
    $testData = @(
        @("Unpatched SQL Server Vulnerability", "SQL Server 2019 instance has critical vulnerability CVE-2023-1234 that allows remote code execution", "Critical", "Likely", "Highly Exposed", "John Smith", "Database", "IT Operations", "Jane Doe", "SQL-PROD-01", "Database Patching Policy", "Mike Johnson", "12/31/2024"),
        @("Weak Password Policy Implementation", "Current password policy allows passwords as short as 6 characters without complexity requirements", "High", "Possible", "Moderately Exposed", "Sarah Wilson", "Identity Management", "Human Resources", "Bob Brown", "Active Directory", "Password Complexity Policy", "Lisa Chen", "01/15/2025"),
        @("Missing Firewall Rules for DMZ", "DMZ servers are accessible from internal network without proper segmentation", "Medium", "Unlikely", "Exposed", "Tom Anderson", "Network Security", "IT Infrastructure", "Carol White", "DMZ-Web-01", "Network Segmentation Policy", "David Miller", "02/28/2025"),
        @("Outdated Antivirus Signatures", "Workstation antivirus signatures are 30+ days old due to update service issues", "Low", "Possible", "Slightly Exposed", "Emily Davis", "Endpoint Security", "IT Operations", "Frank Garcia", "Workstation Fleet", "Endpoint Protection Policy", "Alex Turner", "11/30/2024"),
        @("Excessive Administrative Privileges", "Multiple users have unnecessary domain administrator rights", "High", "Likely", "Moderately Exposed", "Robert Lee", "Identity Management", "IT Security", "Helen Rodriguez", "Active Directory", "Privileged Access Management", "Jennifer Kim", "01/10/2025")
    )

    # Add data rows
    for ($row = 0; $row -lt $testData.Count; $row++) {
        for ($col = 0; $col -lt $testData[$row].Count; $col++) {
            $worksheet.Cells.Item($row + 2, $col + 1) = $testData[$row][$col]
        }
    }

    # Format the worksheet
    $usedRange = $worksheet.UsedRange
    $usedRange.Columns.AutoFit() | Out-Null

    # Save the file
    $filePath = Join-Path (Get-Location) "test_findings.xlsx"
    $workbook.SaveAs($filePath, 51) # 51 = xlOpenXMLWorkbook
    $workbook.Close()
    $excel.Quit()

    # Clean up COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    Write-Host "Successfully created test_findings.xlsx with 5 sample findings" -ForegroundColor Green
    Write-Host "File location: $filePath" -ForegroundColor Green
}
catch {
    Write-Host "Error creating Excel file: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Excel might not be installed or accessible via COM" -ForegroundColor Yellow
}