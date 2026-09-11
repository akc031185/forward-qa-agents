package com.fabricated.shop.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

public class LoginPage {
    private final WebDriver driver;

    @FindBy(id = "username")
    private WebElement usernameInput;

    @FindBy(name = "password")
    private WebElement passwordInput;

    @FindBy(css = "button[type='submit']")
    private WebElement signInButton;

    private final By errorBanner = By.xpath("//div[@class='alert alert-danger']");
    private final By forgotPasswordLink = By.linkText("Forgot your password?");

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }

    public void open() {
        driver.get("https://shop.example.test/login");
    }

    public void login(String user, String pass) {
        usernameInput.clear();
        usernameInput.sendKeys(user);
        passwordInput.sendKeys(pass);
        signInButton.click();
    }

    public String errorText() {
        return driver.findElement(errorBanner).getText();
    }

    public void goToForgotPassword() {
        driver.findElement(forgotPasswordLink).click();
    }
}
