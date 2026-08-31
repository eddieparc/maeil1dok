export type SocialSignupProvider = 'apple' | 'google' | 'kakao';

export type SocialSignupData = {
  readonly provider_id?: string | null;
  readonly email?: string | null;
  readonly suggested_nickname?: string | null;
  readonly profile_image?: string | null;
  readonly signup_token?: string | null;
};

export type SocialSignupNavigation = {
  readonly url: string;
  readonly script: string;
};

export const buildSocialSignupNavigation = (
  webAppUrl: string,
  provider: SocialSignupProvider,
  data: SocialSignupData,
): SocialSignupNavigation => {
  const url = new URL(`/auth/${provider}/setup`, webAppUrl).toString();
  const serializedData = JSON.stringify(data);
  const script = `
    sessionStorage.setItem('social_signup_data', ${JSON.stringify(serializedData)});
    window.location.href = ${JSON.stringify(url)};
    true;
  `;
  return { url, script };
};
