import { useTranslation } from 'react-i18next';

import { UsagePage as UsageContent } from '@/features/SessionUsage';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

const Page = () => {
  const { t } = useTranslation('subscription');
  return (
    <>
      <SettingHeader title={t('sessionBilling.title')} />
      <UsageContent />
    </>
  );
};

export default Page;
