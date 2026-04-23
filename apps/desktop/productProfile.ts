export interface ProductProfile {
  appId: string;
  appName: string;
  productName: string;
  dbFileName: string;
  backupPrefix: string;
}

export const PRODUCT_PROFILE: ProductProfile = {
  appId: 'com.billme.lite',
  appName: 'Billme Lite',
  productName: 'Billme Lite',
  dbFileName: 'billme-lite.sqlite',
  backupPrefix: 'billme-lite',
};
