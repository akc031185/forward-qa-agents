const { Builder, By, until, Key } = require('selenium-webdriver');
const assert = require('assert');

const BASE_URL = 'https://shop.example.test';

describe('Profile page', function () {
  this.timeout(30000);
  let driver;

  beforeEach(async () => {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.get(BASE_URL + '/login');
    await driver.findElement(By.id('username')).sendKeys('qa.buyer@example.test');
    await driver.findElement(By.name('password')).sendKeys('Secret123!', Key.RETURN);
  });

  afterEach(async () => {
    await driver.quit();
  });

  it('shows the saved display name', async () => {
    await driver.get(BASE_URL + '/account/profile');
    await driver.wait(until.elementLocated(By.id('display-name')), 5000);
    const value = await driver.findElement(By.id('display-name')).getAttribute('value');
    assert.strictEqual(value, 'QA Buyer');
  });

  it('can upload an avatar', async () => {
    await driver.get(BASE_URL + '/account/profile');
    await driver.findElement(By.css('input[type="file"]')).sendKeys('/tmp/avatar.png');
    await driver.findElement(By.css('#avatar-form button')).click();
    await driver.sleep(2000);
    const toast = await driver.findElement(By.className('toast-success'));
    assert.equal(await toast.getText(), 'Avatar updated');
    await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  });

  it('sign out returns to login', async () => {
    await driver.findElement(By.linkText('Sign out')).click();
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/login'));
  });
});
