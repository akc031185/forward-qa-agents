package com.fabricated.shop.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;

public class LoginSteps {
    private final WebDriver driver = DriverHolder.get();

    @Given("I am on the login page")
    public void iAmOnTheLoginPage() {
        driver.get("https://shop.example.test/login");
    }

    @When("I enter username {string} and password {string}")
    public void iEnterCredentials(String user, String pass) {
        driver.findElement(By.id("username")).sendKeys(user);
        driver.findElement(By.name("password")).sendKeys(pass);
    }

    @When("I click the sign in button")
    public void iClickSignIn() {
        driver.findElement(By.cssSelector("button[type='submit']")).click();
    }

    @Then("I should see the account dashboard")
    public void iShouldSeeDashboard() {
        Assert.assertTrue(driver.findElement(By.id("dashboard")).isDisplayed());
    }

    @Then("^I should see the error \"([^\"]*)\"$")
    public void iShouldSeeTheError(String expected) {
        Assert.assertEquals(driver.findElement(By.cssSelector(".alert-danger")).getText(), expected);
    }
}
