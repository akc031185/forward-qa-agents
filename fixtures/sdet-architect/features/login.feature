@smoke @login
Feature: Customer login
  As a returning customer
  I want to sign in
  So that I can see my orders

  Background:
    Given I am on the login page

  Scenario: Successful login
    When I enter username "qa.buyer@example.test" and password "Secret123!"
    And I click the sign in button
    Then I should see the account dashboard

  Scenario: Wrong password shows an error
    When I enter username "qa.buyer@example.test" and password "wrong"
    And I click the sign in button
    Then I should see the error "Invalid email or password"

  Scenario Outline: Locked accounts
    When I enter username "<user>" and password "<pass>"
    And I click the sign in button
    Then I should see the error "<message>"

    Examples:
      | user                     | pass      | message                 |
      | locked.one@example.test  | Secret123 | Your account is locked  |
      | locked.two@example.test  | Secret123 | Your account is locked  |
