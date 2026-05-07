export interface ProductProfile {
  appId: string;
  appName: string;
  productName: string;
  dbFileName: string;
  backupPrefix: string;
}

export const PRODUCT_PROFILE: ProductProfile = {
  appId: 'com.billme.pro',
  appName: 'Billme Pro',
  productName: 'Billme Pro',
  dbFileName: 'billme-pro-v2.sqlite',
  backupPrefix: 'billme-pro-v2',
};
