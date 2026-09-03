import { getSetupRates, type SetupRateSource } from '../../lib/setupRates';

interface SetupRatePillsProps {
  setup?: SetupRateSource | null;
}

function SetupRatePills({ setup }: SetupRatePillsProps) {
  const { single, multi } = getSetupRates(setup);

  return (
    <div className="setup-rate-pills">
      <span className="setup-rate-pill solo">
        <span className="setup-rate-kind">1P</span>
        ₹{single}/hr
      </span>
      <span className="setup-rate-pill multi">
        <span className="setup-rate-kind">MP</span>
        ₹{multi}/hr
      </span>
    </div>
  );
}

export default SetupRatePills;
