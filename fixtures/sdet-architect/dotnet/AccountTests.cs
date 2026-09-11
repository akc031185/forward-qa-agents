using System;
using System.Threading;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace Fabricated.Shop.UiTests
{
    [TestFixture]
    public class AccountTests
    {
        private IWebDriver _driver;
        private const string BaseUrl = "https://shop.example.test";

        [SetUp]
        public void SetUp()
        {
            _driver = new ChromeDriver();
            _driver.Navigate().GoToUrl(BaseUrl + "/login");
            _driver.FindElement(By.Id("username")).SendKeys("qa.buyer@example.test");
            _driver.FindElement(By.Name("password")).SendKeys("Secret123!");
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
        }

        [TearDown]
        public void TearDown()
        {
            _driver.Quit();
        }

        [Test]
        public void UpdateDisplayName()
        {
            _driver.Navigate().GoToUrl(BaseUrl + "/account/profile");
            IWebElement nameField = _driver.FindElement(By.Id("display-name"));
            nameField.Clear();
            nameField.SendKeys("QA Buyer");
            _driver.FindElement(By.XPath("//button[@id='save-profile']")).Click();
            Thread.Sleep(1500);
            Assert.AreEqual("Profile saved", _driver.FindElement(By.ClassName("toast-success")).Text);
        }

        [Test]
        public void ChangeNewsletterPreference()
        {
            _driver.Navigate().GoToUrl(BaseUrl + "/account/preferences");
            var dropdown = new SelectElement(_driver.FindElement(By.Id("newsletter-frequency")));
            dropdown.SelectByText("Weekly");
            _driver.FindElement(By.Id("save-preferences")).Click();
            var wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
            wait.Until(d => d.FindElement(By.ClassName("toast-success")));
            Assert.IsTrue(_driver.FindElement(By.ClassName("toast-success")).Displayed);
            Assert.That(_driver.Title, Is.EqualTo("Preferences - Fabricated Shop"));
        }

        [Test]
        public void OrdersLinkNavigates()
        {
            _driver.FindElement(By.LinkText("My orders")).Click();
            Assert.IsTrue(_driver.Url.Contains("/account/orders"));
        }
    }
}
