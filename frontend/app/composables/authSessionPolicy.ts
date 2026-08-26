export interface AuthRefreshDependencies<User> {
  fetchUser: () => Promise<User | null>
  refreshToken: (options: { logoutOnFailure: boolean }) => Promise<boolean>
  logout: () => Promise<void>
}

export interface AuthRefreshOptions {
  logoutOnFailure?: boolean
}

export async function fetchUserWithRefreshPolicy<User>(
  dependencies: AuthRefreshDependencies<User>,
  options: AuthRefreshOptions = {},
): Promise<User | null> {
  const user = await dependencies.fetchUser()
  if (user) return user

  const refreshed = await dependencies.refreshToken({ logoutOnFailure: false })
  if (!refreshed) {
    if (options.logoutOnFailure) {
      await dependencies.logout()
    }
    return null
  }

  return dependencies.fetchUser()
}

export function revalidateAuthSession<User>(
  dependencies: AuthRefreshDependencies<User>,
): Promise<User | null> {
  return fetchUserWithRefreshPolicy(dependencies, { logoutOnFailure: true })
}

export interface InitialAuthDependencies<User> {
  fetchUser: () => Promise<User | null>
  fetchUserWithRefresh: () => Promise<User | null>
}

export function fetchInitialAuthUser<User>(
  cachedUser: User | null,
  dependencies: InitialAuthDependencies<User>,
): Promise<User | null> {
  return cachedUser
    ? dependencies.fetchUserWithRefresh()
    : dependencies.fetchUser()
}
