import {queueMockResponses} from '../../__tests__/test-helper';
import {testConfig} from '../../__tests__/test-config';
import {Session} from '../../session/session';
import {BillingInterval} from '../../types';
import {shopifyApi} from '../..';
import {BillingCheckResponseObject, BillingConfig} from '../types';
import {
  DOMAIN,
  ACCESS_TOKEN,
  GRAPHQL_BASE_REQUEST,
} from '../../__test-helpers__';

import * as Responses from './responses';

const NON_RECURRING_CONFIGS: BillingConfig = {
  [Responses.PLAN_1]: {
    amount: 5,
    currencyCode: 'USD',
    interval: BillingInterval.OneTime,
  },
  [Responses.PLAN_2]: {
    amount: 10,
    currencyCode: 'USD',
    interval: BillingInterval.OneTime,
  },
};

const RECURRING_CONFIGS: BillingConfig = {
  [Responses.PLAN_1]: {
    amount: 5,
    currencyCode: 'USD',
    interval: BillingInterval.Every30Days,
  },
  [Responses.PLAN_2]: {
    amount: 10,
    currencyCode: 'USD',
    interval: BillingInterval.Annual,
  },
};

describe('shopify.billing.check', () => {
  const session = new Session({
    id: '1234',
    shop: DOMAIN,
    state: '1234',
    isOnline: true,
    accessToken: ACCESS_TOKEN,
    scope: 'write_products',
  });

  describe('with no billing config', () => {
    test('returns all purchases if no plans are given', async () => {
      const shopify = shopifyApi(testConfig({billing: undefined}));

      queueMockResponses([Responses.MULTIPLE_SUBSCRIPTIONS]);

      const response = await shopify.billing.check({session, isTest: true});

      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();

      expect(response.hasActivePayment).toBe(true);
      expect(response.oneTimePurchases.length).toBe(0);
      expect(response.appSubscriptions.length).toBe(2);
    });
  });

  describe('with non-recurring configs', () => {
    test(`handles empty responses`, async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses([Responses.EMPTY_SUBSCRIPTIONS]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: true,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('oneTimePurchases'),
      }).toMatchMadeHttpRequest();
    });

    test(`returns false if non-test and only test purchases are returned`, async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_ONE_TIME_PAYMENT]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: false,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('oneTimePurchases'),
      }).toMatchMadeHttpRequest();
    });

    test(`returns false if purchase is for a different plan`, async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_ONE_TIME_PAYMENT]);

      const response = await shopify.billing.check({
        session,
        plans: [Responses.PLAN_2],
        isTest: false,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('oneTimePurchases'),
      }).toMatchMadeHttpRequest();
    });

    test('defaults to test purchases', async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_ONE_TIME_PAYMENT]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
      });

      expect(response.hasActivePayment).toBe(true);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('oneTimePurchases'),
      }).toMatchMadeHttpRequest();
    });

    test('ignores non-active payments', async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_INACTIVE_ONE_TIME_PAYMENT]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: true,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('oneTimePurchases'),
      }).toMatchMadeHttpRequest();
    });

    test('paginates until a payment is found', async () => {
      const shopify = shopifyApi(testConfig({billing: NON_RECURRING_CONFIGS}));

      queueMockResponses(
        [Responses.EXISTING_ONE_TIME_PAYMENT_WITH_PAGINATION[0]],
        [Responses.EXISTING_ONE_TIME_PAYMENT_WITH_PAGINATION[1]],
      );

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: true,
      });

      expect(response.hasActivePayment).toBe(true);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: {
          query: expect.stringContaining('oneTimePurchases'),
          variables: expect.objectContaining({endCursor: null}),
        },
      }).toMatchMadeHttpRequest();
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: {
          query: expect.stringContaining('oneTimePurchases'),
          variables: expect.objectContaining({endCursor: 'end_cursor'}),
        },
      }).toMatchMadeHttpRequest();
    });
  });

  describe('with recurring config', () => {
    test(`handles empty responses`, async () => {
      const shopify = shopifyApi(testConfig({billing: RECURRING_CONFIGS}));

      queueMockResponses([Responses.EMPTY_SUBSCRIPTIONS]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: true,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();
    });

    test(`returns false if non-test and only test purchases are returned`, async () => {
      const shopify = shopifyApi(testConfig({billing: RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_SUBSCRIPTION]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        isTest: false,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();
    });

    test(`returns false if purchase is for a different plan`, async () => {
      const shopify = shopifyApi(testConfig({billing: RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_SUBSCRIPTION]);

      const response = await shopify.billing.check({
        session,
        plans: [Responses.PLAN_2],
        isTest: false,
      });

      expect(response.hasActivePayment).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();
    });

    test('defaults to test purchases', async () => {
      const shopify = shopifyApi(testConfig({billing: RECURRING_CONFIGS}));

      queueMockResponses([Responses.EXISTING_SUBSCRIPTION]);

      const response = await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
      });

      expect(response.hasActivePayment).toBe(true);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();
    });

    test('check returns valid response object', async () => {
      const shopify = shopifyApi(testConfig({billing: RECURRING_CONFIGS}));

      queueMockResponses(
        [
          Responses
            .EXISTING_ONE_TIME_PAYMENTS_WITH_PAGINATION_AND_SUBSCRIPTION[0],
        ],
        [
          Responses
            .EXISTING_ONE_TIME_PAYMENTS_WITH_PAGINATION_AND_SUBSCRIPTION[1],
        ],
      );

      const responseObject = (await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        returnObject: true,
      })) as BillingCheckResponseObject;

      expect(responseObject.hasActivePayment).toBeTruthy();
      expect(responseObject.oneTimePurchases.length).toBe(2);
      responseObject.oneTimePurchases.map((purchase) => {
        expect(Responses.ALL_PLANS.includes(purchase.name)).toBeTruthy();
        expect(purchase.status).toBe('ACTIVE');
        expect(purchase.id).toBeDefined();
      });
      expect(responseObject.appSubscriptions.length).toBe(1);
      responseObject.appSubscriptions.map((subscription) => {
        expect(Responses.ALL_PLANS.includes(subscription.name)).toBeTruthy();
        expect(subscription.id).toBeDefined();
      });
    });
  });

  describe('with disabled future flag', () => {
    test('check returns valid response object', async () => {
      const shopify = shopifyApi(
        testConfig({
          billing: RECURRING_CONFIGS,
          future: {unstable_managedPricingSupport: false},
        }),
      );

      queueMockResponses(
        [
          Responses
            .EXISTING_ONE_TIME_PAYMENTS_WITH_PAGINATION_AND_SUBSCRIPTION[0],
        ],
        [
          Responses
            .EXISTING_ONE_TIME_PAYMENTS_WITH_PAGINATION_AND_SUBSCRIPTION[1],
        ],
      );

      const responseObject = (await shopify.billing.check({
        session,
        plans: Responses.ALL_PLANS,
        returnObject: true,
      })) as BillingCheckResponseObject;

      expect(responseObject.hasActivePayment).toBeTruthy();
      expect(responseObject.oneTimePurchases.length).toBe(2);
      responseObject.oneTimePurchases.map((purchase) => {
        expect(Responses.ALL_PLANS.includes(purchase.name)).toBeTruthy();
        expect(purchase.status).toBe('ACTIVE');
        expect(purchase.id).toBeDefined();
      });
      expect(responseObject.appSubscriptions.length).toBe(1);
      responseObject.appSubscriptions.map((subscription) => {
        expect(Responses.ALL_PLANS.includes(subscription.name)).toBeTruthy();
        expect(subscription.id).toBeDefined();
      });
    });

    test('returns boolean response when not requesting object (default)', async () => {
      const shopify = shopifyApi(
        testConfig({
          billing: RECURRING_CONFIGS,
          future: {unstable_managedPricingSupport: false},
        }),
      );

      queueMockResponses([Responses.EXISTING_SUBSCRIPTION]);

      const response = await shopify.billing.check({
        session,
        plans: [Responses.PLAN_2],
        isTest: false,
      });

      expect(response).toBe(false);
      expect({
        ...GRAPHQL_BASE_REQUEST,
        data: expect.stringContaining('activeSubscriptions'),
      }).toMatchMadeHttpRequest();
    });
  });
});
