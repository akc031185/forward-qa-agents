package com.fabricated.shop.tests;

import com.fabricated.shop.pages.LoginPage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;

public class CheckoutTest {
    private static final String BASE_URL = "https://shop.example.test";
    private static final String QA_USER = "qa.buyer@example.test";
    private static final String QA_PASS = "Secret123!";

    private WebDriver driver;
    private LoginPage loginPage;

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver();
        driver.manage().window().maximize();
        loginPage = new LoginPage(driver);
        loginPage.open();
        loginPage.login(QA_USER, QA_PASS);
    }

    @AfterMethod
    public void tearDown() {
        driver.quit();
    }

    @Test(priority = 1)
    public void addItemToCartAndCheckout() {
        driver.get(BASE_URL + "/catalog");
        driver.findElement(By.id("search-box")).sendKeys("wireless mouse");
        driver.findElement(By.cssSelector("button.search-submit")).click();
        Thread.sleep(2000);
        driver.findElement(By.xpath("//div[@class='product-card'][1]//button[contains(text(),'Add to cart')]")).click();
        WebElement cartBadge = driver.findElement(By.id("cart-count"));
        Assert.assertEquals(cartBadge.getText(), "1");
        driver.findElement(By.linkText("Cart")).click();
        new WebDriverWait(driver, Duration.ofSeconds(10))
            .until(ExpectedConditions.visibilityOfElementLocated(By.id("checkout-button")));
        driver.findElement(By.id("checkout-button")).click();
        Select shipping = new Select(driver.findElement(By.name("shippingMethod")));
        shipping.selectByVisibleText("Express (1-2 days)");
        driver.findElement(By.id("place-order")).click();
        Assert.assertTrue(driver.findElement(By.cssSelector(".order-confirmation")).isDisplayed());
        Assert.assertEquals(driver.getTitle(), "Order confirmed - Fabricated Shop");
    }

    @Test(priority = 2)
    public void emptyCartShowsMessage() {
        driver.navigate().to(BASE_URL + "/cart");
        String message = driver.findElement(By.xpath("//p[text()='Your cart is empty']")).getText();
        Assert.assertEquals(message, "Your cart is empty");
        Assert.assertEquals(driver.findElements(By.cssSelector(".cart-line")).size(), 0);
    }

    @Test
    public void legacyHelperOnly() {
        driver.get(BASE_URL + "/account");
        takeScreenshotAndUpload(driver, "account");
        driver.findElement(By.xpath("/html/body/div[2]/div/div[3]/ul/li[4]/a")).click();
    }

    private void takeScreenshotAndUpload(WebDriver d, String name) {
        // legacy reporting helper; intentionally not convertible
    }
}
