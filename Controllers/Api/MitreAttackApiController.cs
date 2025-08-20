using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace CyberRiskApp.Controllers.Api
{
    [ApiController]
    [Route("api/mitre-attack")]
    [Authorize]
    public class MitreAttackApiController : ControllerBase
    {
        [HttpGet("techniques")]
        public IActionResult GetMitreTechniques([FromQuery] string? search = null)
        {
            try
            {
                var techniques = GetMitreAttackTechniques();

                if (!string.IsNullOrEmpty(search))
                {
                    techniques = techniques.Where(t => 
                        t.Id.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        t.Name.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        t.Description.Contains(search, StringComparison.OrdinalIgnoreCase)
                    ).ToList();
                }

                return Ok(techniques.Take(50)); // Limit to 50 results for performance
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving MITRE ATT&CK techniques", details = ex.Message });
            }
        }

        [HttpGet("techniques/{techniqueId}")]
        public IActionResult GetMitreTechnique(string techniqueId)
        {
            try
            {
                var technique = GetMitreAttackTechniques()
                    .FirstOrDefault(t => t.Id.Equals(techniqueId, StringComparison.OrdinalIgnoreCase));

                if (technique == null)
                {
                    return NotFound(new { error = "MITRE ATT&CK technique not found" });
                }

                return Ok(technique);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving MITRE ATT&CK technique", details = ex.Message });
            }
        }

        [HttpGet("tactics")]
        public IActionResult GetMitreTactics()
        {
            try
            {
                var tactics = GetMitreAttackTactics();
                return Ok(tactics);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving MITRE ATT&CK tactics", details = ex.Message });
            }
        }

        private List<MitreTechnique> GetMitreAttackTechniques()
        {
            // This is a simplified list of common MITRE ATT&CK techniques
            // In a production system, this would come from a database or external API
            return new List<MitreTechnique>
            {
                // Initial Access
                new("T1566.001", "Phishing: Spearphishing Attachment", "Adversaries may send spearphishing emails with a malicious attachment.", "Initial Access"),
                new("T1566.002", "Phishing: Spearphishing Link", "Adversaries may send spearphishing emails with a malicious link.", "Initial Access"),
                new("T1566.003", "Phishing: Spearphishing via Service", "Adversaries may send spearphishing messages via third-party services.", "Initial Access"),
                new("T1190", "Exploit Public-Facing Application", "Adversaries may attempt to exploit a weakness in an Internet-facing application.", "Initial Access"),
                new("T1133", "External Remote Services", "Adversaries may leverage external remote services to initially access and/or persist within a network.", "Initial Access"),
                new("T1200", "Hardware Additions", "Adversaries may introduce computer accessories, computers, or networking hardware into a system or network.", "Initial Access"),
                new("T1091", "Replication Through Removable Media", "Adversaries may move onto systems by copying malware to removable media.", "Initial Access"),

                // Execution
                new("T1059.001", "Command and Scripting Interpreter: PowerShell", "Adversaries may abuse PowerShell commands and scripts for execution.", "Execution"),
                new("T1059.003", "Command and Scripting Interpreter: Windows Command Shell", "Adversaries may abuse the Windows command shell for execution.", "Execution"),
                new("T1059.005", "Command and Scripting Interpreter: Visual Basic", "Adversaries may abuse Visual Basic (VB) for execution.", "Execution"),
                new("T1059.007", "Command and Scripting Interpreter: JavaScript", "Adversaries may abuse various implementations of JavaScript for execution.", "Execution"),
                new("T1203", "Exploitation for Client Execution", "Adversaries may exploit software vulnerabilities in client applications to execute code.", "Execution"),
                new("T1053.005", "Scheduled Task/Job: Scheduled Task", "Adversaries may abuse the Windows Task Scheduler to perform task scheduling.", "Execution"),

                // Persistence
                new("T1547.001", "Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder", "Adversaries may achieve persistence by adding a program to a startup folder.", "Persistence"),
                new("T1053.005", "Scheduled Task/Job: Scheduled Task", "Adversaries may abuse the Windows Task Scheduler to perform task scheduling.", "Persistence"),
                new("T1543.003", "Create or Modify System Process: Windows Service", "Adversaries may create or modify Windows services to repeatedly execute malicious payloads.", "Persistence"),
                new("T1547.009", "Boot or Logon Autostart Execution: Shortcut Modification", "Adversaries may create or edit shortcuts to run a program during system boot or user login.", "Persistence"),

                // Privilege Escalation
                new("T1548.002", "Abuse Elevation Control Mechanism: Bypass User Account Control", "Adversaries may bypass UAC mechanisms to elevate process privileges.", "Privilege Escalation"),
                new("T1055", "Process Injection", "Adversaries may inject code into processes in order to evade detection.", "Privilege Escalation"),
                new("T1134", "Access Token Manipulation", "Adversaries may modify access tokens to operate under a different user or system security context.", "Privilege Escalation"),

                // Defense Evasion
                new("T1070.004", "Indicator Removal on Host: File Deletion", "Adversaries may delete files left behind by the actions of their intrusion activity.", "Defense Evasion"),
                new("T1027", "Obfuscated Files or Information", "Adversaries may attempt to make an executable or file difficult to discover or analyze.", "Defense Evasion"),
                new("T1112", "Modify Registry", "Adversaries may interact with the Windows Registry to hide configuration information.", "Defense Evasion"),
                new("T1562.001", "Impair Defenses: Disable or Modify Tools", "Adversaries may modify and/or disable security tools to avoid possible detection.", "Defense Evasion"),

                // Credential Access
                new("T1555", "Credentials from Password Stores", "Adversaries may search for common password storage locations to obtain user credentials.", "Credential Access"),
                new("T1003.001", "OS Credential Dumping: LSASS Memory", "Adversaries may attempt to access credential material stored in LSASS.", "Credential Access"),
                new("T1110.001", "Brute Force: Password Guessing", "Adversaries may use a single or small list of commonly used passwords against many accounts.", "Credential Access"),
                new("T1110.003", "Brute Force: Password Spraying", "Adversaries may use a single or small list of commonly used passwords against many accounts.", "Credential Access"),
                new("T1552.001", "Unsecured Credentials: Credentials In Files", "Adversaries may search local file systems and remote file shares for files containing insecurely stored credentials.", "Credential Access"),

                // Discovery
                new("T1083", "File and Directory Discovery", "Adversaries may enumerate files and directories or search in specific locations.", "Discovery"),
                new("T1057", "Process Discovery", "Adversaries may attempt to get information about running processes.", "Discovery"),
                new("T1018", "Remote System Discovery", "Adversaries may attempt to get a listing of other systems by IP address, hostname, or other logical identifier.", "Discovery"),
                new("T1016", "System Network Configuration Discovery", "Adversaries may look for details about the network configuration and settings.", "Discovery"),
                new("T1082", "System Information Discovery", "An adversary may attempt to get detailed information about the operating system and hardware.", "Discovery"),

                // Lateral Movement
                new("T1021.001", "Remote Services: Remote Desktop Protocol", "Adversaries may use Valid Accounts to log into a computer using RDP.", "Lateral Movement"),
                new("T1021.002", "Remote Services: SMB/Windows Admin Shares", "Adversaries may use Valid Accounts to interact with a remote network share using SMB.", "Lateral Movement"),
                new("T1550.002", "Use Alternate Authentication Material: Pass the Hash", "Adversaries may pass the hash to move laterally within an environment.", "Lateral Movement"),

                // Collection
                new("T1005", "Data from Local System", "Adversaries may search local system sources, such as file systems and configuration files.", "Collection"),
                new("T1039", "Data from Network Shared Drive", "Adversaries may search network shares on computers they have compromised.", "Collection"),
                new("T1113", "Screen Capture", "Adversaries may attempt to take screen captures of the desktop to gather information.", "Collection"),
                new("T1056.001", "Input Capture: Keylogging", "Adversaries may log user keystrokes to intercept credentials as the user types them.", "Collection"),

                // Command and Control
                new("T1071.001", "Application Layer Protocol: Web Protocols", "Adversaries may communicate using application layer protocols associated with web traffic.", "Command and Control"),
                new("T1573.001", "Encrypted Channel: Symmetric Cryptography", "Adversaries may employ a known symmetric encryption algorithm to conceal command and control traffic.", "Command and Control"),
                new("T1105", "Ingress Tool Transfer", "Adversaries may transfer tools or other files from an external system into a compromised environment.", "Command and Control"),

                // Exfiltration
                new("T1041", "Exfiltration Over C2 Channel", "Adversaries may steal data by exfiltrating it over an existing command and control channel.", "Exfiltration"),
                new("T1567.002", "Exfiltration Over Web Service: Exfiltration to Cloud Storage", "Adversaries may exfiltrate data to a cloud storage service.", "Exfiltration"),
                new("T1020", "Automated Exfiltration", "Adversaries may exfiltrate data, such as sensitive documents, through the use of automated processing.", "Exfiltration"),

                // Impact
                new("T1486", "Data Encrypted for Impact", "Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability.", "Impact"),
                new("T1485", "Data Destruction", "Adversaries may destroy data and files on specific systems or in large numbers on a network.", "Impact"),
                new("T1490", "Inhibit System Recovery", "Adversaries may delete or remove built-in operating system data and turn off services designed to aid in the recovery of a corrupted system.", "Impact")
            };
        }

        private List<MitreTactic> GetMitreAttackTactics()
        {
            return new List<MitreTactic>
            {
                new("TA0001", "Initial Access", "The adversary is trying to get into your network."),
                new("TA0002", "Execution", "The adversary is trying to run malicious code."),
                new("TA0003", "Persistence", "The adversary is trying to maintain their foothold."),
                new("TA0004", "Privilege Escalation", "The adversary is trying to gain higher-level permissions."),
                new("TA0005", "Defense Evasion", "The adversary is trying to avoid being detected."),
                new("TA0006", "Credential Access", "The adversary is trying to steal account names and passwords."),
                new("TA0007", "Discovery", "The adversary is trying to figure out your environment."),
                new("TA0008", "Lateral Movement", "The adversary is trying to move through your environment."),
                new("TA0009", "Collection", "The adversary is trying to gather data of interest to their goal."),
                new("TA0011", "Command and Control", "The adversary is trying to communicate with compromised systems."),
                new("TA0010", "Exfiltration", "The adversary is trying to steal data."),
                new("TA0040", "Impact", "The adversary is trying to manipulate, interrupt, or destroy your systems and data.")
            };
        }
    }

    public record MitreTechnique(string Id, string Name, string Description, string Tactic);
    public record MitreTactic(string Id, string Name, string Description);
}