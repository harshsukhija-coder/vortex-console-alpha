export interface SetupRateSource {
  chargePerPersonPerHour?: number;
  singlePlayerPrice?: number;
  multiplayerPrice?: number;
}

export function getSetupRates(setup?: SetupRateSource | null) {
  const fallback = setup?.chargePerPersonPerHour ?? 0;
  return {
    single: setup?.singlePlayerPrice ?? fallback,
    multi: setup?.multiplayerPrice ?? fallback,
  };
}

export function getSetupRateForPlayers(
  setup: SetupRateSource | null | undefined,
  playersCount: number,
) {
  const { single, multi } = getSetupRates(setup);
  return playersCount > 1 ? multi : single;
}

export function formatSetupRatesShort(setup?: SetupRateSource | null) {
  const { single, multi } = getSetupRates(setup);
  return `1P ₹${single}/hr · MP ₹${multi}/hr`;
}
