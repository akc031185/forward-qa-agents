package com.fabricated.shop.tests;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.firefox.FirefoxDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SearchTest {
    private WebDriver driver;

    @BeforeEach
    void setUp() {
        driver = new FirefoxDriver();
        driver.get("https://shop.example.test/");
    }

    @AfterEach
    void tearDown() {
        driver.quit();
    }

    @Test
    void searchByKeywordShowsResults() {
        WebElement search = driver.findElement(By.id("search-box"));
        search.sendKeys("keyboard");
        search.sendKeys(Keys.ENTER);
        WebElement heading = driver.findElement(By.cssSelector("h1.results-heading"));
        assertEquals("Results for \"keyboard\"", heading.getText());
        assertTrue(driver.findElement(By.className("results-grid")).isDisplayed());
    }

    @Test
    void searchWithNoResultsShowsEmptyState() {
        driver.findElement(By.id("search-box")).sendKeys("zzzz-no-such-item");
        driver.findElement(By.cssSelector("button.search-submit")).click();
        assertTrue(driver.getCurrentUrl().contains("q=zzzz-no-such-item"));
        assertEquals("No products found", driver.findElement(By.id("empty-state")).getText());
    }

    @Test
    void openFirstResultDetails() {
        driver.findElement(By.id("search-box")).sendKeys("monitor");
        driver.findElement(By.cssSelector("button.search-submit")).click();
        driver.findElement(By.partialLinkText("27-inch")).click();
        driver.findElement(By.tagName("h1")).isDisplayed();
    }
}
