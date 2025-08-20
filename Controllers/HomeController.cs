using System.Diagnostics;
using CyberRiskApp.Models;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            // If user is already authenticated, redirect to risk backlog
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "RiskBacklog");
            }

            // Show welcome page for unauthenticated users
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        public IActionResult TestSelect2()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}