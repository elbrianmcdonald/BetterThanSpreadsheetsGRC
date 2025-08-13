# Create updated test Excel file for risks upload (without ALE column)
try {
    # Create Excel COM object
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $workbook = $excel.Workbooks.Add()
    $worksheet = $workbook.Worksheets.Item(1)

    # Add headers - UPDATED: Removed ALE column
    $headers = @(
        "Title", "Description", "Asset", "Business Unit", "Threat Scenario", 
        "Risk Level", "Treatment Strategy", "Owner"
    )

    for ($i = 0; $i -lt $headers.Count; $i++) {
        $worksheet.Cells.Item(1, $i + 1) = $headers[$i]
    }

    # Add test data - UPDATED: Removed ALE values
    $testData = @(
        @("Ransomware Attack on Production Systems", "Critical infrastructure vulnerable to ransomware encryption affecting business operations", "Production Servers", "IT Operations", "Malicious email attachment or compromised credentials lead to network infiltration", "Critical", "Mitigate", "CISO"),
        @("SQL Injection Vulnerability", "Web application database vulnerable to SQL injection attacks exposing customer data", "Customer Database", "Development", "Attacker exploits input validation weakness to access sensitive data", "High", "Mitigate", "Development Lead"),
        @("Data Center Power Failure", "Primary data center loses power for extended period causing service disruption", "Data Center Infrastructure", "Operations", "Utility power outage exceeds UPS and generator capacity", "Critical", "Transfer", "Operations Manager"),
        @("Insider Threat - Privileged User", "Malicious or negligent privileged user accessing or modifying sensitive systems", "Active Directory", "IT Security", "Disgruntled employee or compromised administrator account misuses access", "High", "Mitigate", "IT Security Manager"),
        @("Cloud Service Provider Outage", "Third-party cloud service experiences extended outage affecting business applications", "Cloud Infrastructure", "IT Architecture", "Provider experiences technical issues, cyber attack, or regional disaster", "Medium", "Accept", "Cloud Architect"),
        @("Phishing Campaign Success", "Employees fall victim to targeted phishing campaign resulting in credential compromise", "Email System", "Human Resources", "Social engineering attack tricks users into providing login credentials", "Medium", "Mitigate", "Security Awareness Manager"),
        @("Unpatched Critical Vulnerability", "Operating systems and applications contain unpatched security vulnerabilities", "Server Infrastructure", "System Administration", "Threat actors exploit known vulnerabilities before patches are applied", "High", "Mitigate", "Systems Administrator"),
        @("Physical Security Breach", "Unauthorized physical access to secure facilities or server rooms", "Physical Infrastructure", "Facilities", "Social engineering, tailgating, or compromised access cards", "Low", "Mitigate", "Facilities Manager")
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

    # Make header row bold
    $headerRange = $worksheet.Range("A1:H1")  # Updated range - only H columns now
    $headerRange.Font.Bold = $true
    $headerRange.Interior.Color = 15773696  # Light gray background

    # Save the file (replace the old one)
    $filePath = Join-Path (Get-Location) "test_risks.xlsx"
    $workbook.SaveAs($filePath, 51) # 51 = xlOpenXMLWorkbook
    $workbook.Close()
    $excel.Quit()

    # Clean up COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    Write-Host "Successfully updated test_risks.xlsx with 8 sample risks (NO ALE column)" -ForegroundColor Green
    Write-Host "File location: $filePath" -ForegroundColor Green
    
    Write-Host "`nUpdated test file includes:" -ForegroundColor Cyan
    Write-Host "- 8 columns: Title, Description, Asset, Business Unit, Threat Scenario, Risk Level, Treatment Strategy, Owner" -ForegroundColor Yellow
    Write-Host "- Critical risks: Ransomware, Data Center Power" -ForegroundColor Yellow
    Write-Host "- High risks: SQL Injection, Insider Threat, Vulnerabilities" -ForegroundColor Yellow  
    Write-Host "- Medium risks: Cloud Outage, Phishing" -ForegroundColor Yellow
    Write-Host "- Low risks: Physical Security" -ForegroundColor Yellow
    Write-Host "- Mix of treatment strategies: Mitigate, Transfer, Accept" -ForegroundColor Yellow
    Write-Host "- NO ALE VALUES (quantitative risks no longer used)" -ForegroundColor Red
}
catch {
    Write-Host "Error creating Excel file: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Excel might not be installed or accessible via COM" -ForegroundColor Yellow
}