#!/usr/bin/env python3
import pandas as pd
from datetime import datetime

# Create test data
data = [
    {
        'Title': 'Unpatched SQL Server Vulnerability',
        'Details': 'SQL Server 2019 instance has critical vulnerability CVE-2023-1234 that allows remote code execution',
        'Impact': 'Critical',
        'Likelihood': 'Likely',
        'Exposure': 'Highly Exposed',
        'Owner': 'John Smith',
        'Domain': 'Database',
        'Business Unit': 'IT Operations',
        'Business Owner': 'Jane Doe',
        'Asset': 'SQL-PROD-01',
        'Technical Control': 'Database Patching Policy',
        'Assigned To': 'Mike Johnson',
        'SLA Date': '12/31/2024'
    },
    {
        'Title': 'Weak Password Policy Implementation',
        'Details': 'Current password policy allows passwords as short as 6 characters without complexity requirements',
        'Impact': 'High',
        'Likelihood': 'Possible',
        'Exposure': 'Moderately Exposed',
        'Owner': 'Sarah Wilson',
        'Domain': 'Identity Management',
        'Business Unit': 'Human Resources',
        'Business Owner': 'Bob Brown',
        'Asset': 'Active Directory',
        'Technical Control': 'Password Complexity Policy',
        'Assigned To': 'Lisa Chen',
        'SLA Date': '01/15/2025'
    },
    {
        'Title': 'Missing Firewall Rules for DMZ',
        'Details': 'DMZ servers are accessible from internal network without proper segmentation',
        'Impact': 'Medium',
        'Likelihood': 'Unlikely',
        'Exposure': 'Exposed',
        'Owner': 'Tom Anderson',
        'Domain': 'Network Security',
        'Business Unit': 'IT Infrastructure',
        'Business Owner': 'Carol White',
        'Asset': 'DMZ-Web-01',
        'Technical Control': 'Network Segmentation Policy',
        'Assigned To': 'David Miller',
        'SLA Date': '02/28/2025'
    },
    {
        'Title': 'Outdated Antivirus Signatures',
        'Details': 'Workstation antivirus signatures are 30+ days old due to update service issues',
        'Impact': 'Low',
        'Likelihood': 'Possible',
        'Exposure': 'Slightly Exposed',
        'Owner': 'Emily Davis',
        'Domain': 'Endpoint Security',
        'Business Unit': 'IT Operations',
        'Business Owner': 'Frank Garcia',
        'Asset': 'Workstation Fleet',
        'Technical Control': 'Endpoint Protection Policy',
        'Assigned To': 'Alex Turner',
        'SLA Date': '11/30/2024'
    },
    {
        'Title': 'Excessive Administrative Privileges',
        'Details': 'Multiple users have unnecessary domain administrator rights',
        'Impact': 'High',
        'Likelihood': 'Likely',
        'Exposure': 'Moderately Exposed',
        'Owner': 'Robert Lee',
        'Domain': 'Identity Management',
        'Business Unit': 'IT Security',
        'Business Owner': 'Helen Rodriguez',
        'Asset': 'Active Directory',
        'Technical Control': 'Privileged Access Management',
        'Assigned To': 'Jennifer Kim',
        'SLA Date': '01/10/2025'
    }
]

# Create DataFrame
df = pd.DataFrame(data)

# Save to Excel
df.to_excel('test_findings.xlsx', index=False, engine='openpyxl')
print("Created test_findings.xlsx with 5 sample findings")
print("File contains the following columns:", list(df.columns))
print(f"Data shape: {df.shape[0]} rows x {df.shape[1]} columns")