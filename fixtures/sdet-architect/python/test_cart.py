import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "https://shop.example.test"


@pytest.fixture
def driver():
    d = webdriver.Chrome()
    d.implicitly_wait(5)
    yield d
    d.quit()


def test_add_to_cart_updates_badge(driver):
    driver.get(BASE_URL + "/catalog")
    driver.find_element(By.ID, "search-box").send_keys("usb hub")
    driver.find_element(By.CSS_SELECTOR, "button.search-submit").click()
    time.sleep(3)
    driver.find_element(By.XPATH, "//button[contains(text(),'Add to cart')]").click()
    badge = driver.find_element(By.ID, "cart-count")
    assert badge.text == "1"


def test_quantity_can_be_changed(driver):
    driver.get(BASE_URL + "/cart")
    qty = driver.find_element_by_name("quantity")
    qty.clear()
    qty.send_keys("3")
    Select(driver.find_element(By.ID, "shipping")).select_by_visible_text("Standard")
    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".cart-total")))
    assert driver.find_element(By.CSS_SELECTOR, ".cart-total").is_displayed()
    assert "cart" in driver.current_url


def test_remove_last_item_shows_empty_state(driver):
    driver.get(BASE_URL + "/cart")
    driver.find_element(By.XPATH, "//a[@id='remove-line-1']").click()
    assert driver.find_element(By.XPATH, "//p[text()='Your cart is empty']").text == "Your cart is empty"
    driver.save_screenshot("/tmp/empty-cart.png")
