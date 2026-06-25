type PayMongoCheckoutLineItem = {
  name: string;
  amount: number;
  currency: 'PHP';
  quantity: number;
  description?: string;
};

type PayMongoCheckoutSessionInput = {
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  lineItems?: PayMongoCheckoutLineItem[];
  paymentMethodTypes?: string[];
};

type PayMongoError = {
  code?: string;
  detail?: string;
  title?: string;
};

type PayMongoCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
    };
  };
  errors?: PayMongoError[];
};

const PAYMONGO_API_BASE_URL = process.env.PAYMONGO_API_BASE_URL ?? 'https://api.paymongo.com/v1';

function getPayMongoSecretKey() {
  return process.env.PAYMONGO_SECRET_KEY ?? process.env.PAYMONGO_SECRET ?? '';
}

export function hasPayMongoConfig() {
  return Boolean(getPayMongoSecretKey());
}

export function toPayMongoAmount(amount: number) {
  return Math.round(Number(amount) * 100);
}

function getPayMongoAuthHeader() {
  const secretKey = getPayMongoSecretKey();

  if (!secretKey) {
    throw new Error('Missing PAYMONGO_SECRET_KEY');
  }

  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

function flattenPayMongoErrors(payload: PayMongoCheckoutResponse | null, responseStatus: number) {
  const errorMessages = payload?.errors
    ?.map((error) => error.detail || error.title || error.code || '')
    .filter(Boolean)
    .join('; ');

  return errorMessages || `PayMongo request failed (${responseStatus})`;
}

export async function createPayMongoCheckoutSession(input: PayMongoCheckoutSessionInput) {
  const amount = toPayMongoAmount(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('PayMongo amount must be greater than 0');
  }

  const response = await fetch(`${PAYMONGO_API_BASE_URL}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: getPayMongoAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          payment_method_types: input.paymentMethodTypes ?? ['card', 'gcash', 'paymaya'],
          line_items:
            input.lineItems ??
            [
              {
                name: 'LH-Connect Monthly Dues',
                amount,
                currency: 'PHP',
                quantity: 1,
                description: input.description,
              },
            ],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          description: input.description,
          metadata: input.metadata,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as PayMongoCheckoutResponse | null;

  if (!response.ok) {
    throw new Error(flattenPayMongoErrors(payload, response.status));
  }

  const sessionId = payload?.data?.id;
  const checkoutUrl = payload?.data?.attributes?.checkout_url;

  if (!sessionId || !checkoutUrl) {
    throw new Error('PayMongo checkout response did not include a checkout URL');
  }

  return {
    sessionId,
    checkoutUrl,
    raw: payload,
  };
}
