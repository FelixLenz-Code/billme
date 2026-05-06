export interface ProductProfile {
  appId: string;
  appName: string;
  productName: string;
  dbFileName: string;
  backupPrefix: string;
}

export const PRODUCT_PROFILE: ProductProfile = {
  appId: 'com.billme.desktop',
  appName: 'Billme',
  productName: 'Billme',
  dbFileName: 'billme.sqlite',
  backupPrefix: 'billme',
};
