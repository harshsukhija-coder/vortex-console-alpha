import {
  calculateAddOnsTotal,
  type AddOnSelectorProps,
} from '../../lib/bookingAddOns';
import './AddOnSelector.css';

export default function AddOnSelector({
  items,
  selected,
  isLoading = false,
  disabled = false,
  onChange,
}: AddOnSelectorProps) {
  const updateUnits = (addOnId: number, units: number) => {
    const next = selected.filter((item) => item.addOnId !== addOnId);
    if (units > 0) next.push({ addOnId, units });
    onChange(next);
  };

  if (isLoading) {
    return <div className="addon-empty">Loading add-ons...</div>;
  }

  if (items.length === 0) {
    return <div className="addon-empty">No add-ons are currently available.</div>;
  }

  return (
    <div className="addon-selector">
      <div className="addon-list">
        {items.map((item) => {
          const units = selected.find((selection) => selection.addOnId === item.id)?.units ?? 0;
          return (
            <article className={`addon-item ${units > 0 ? 'selected' : ''}`} key={item.id}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="addon-image" />
              ) : (
                <div className="addon-image placeholder">{item.itemName.slice(0, 1)}</div>
              )}
              <div className="addon-copy">
                <strong>{item.itemName}</strong>
                <span>{item.quantity} {item.quantityUnit} · ₹{item.price} each</span>
              </div>
              <div className="addon-counter">
                <button type="button" disabled={disabled || units === 0} onClick={() => updateUnits(item.id, units - 1)}>−</button>
                <span>{units}</span>
                <button type="button" disabled={disabled} onClick={() => updateUnits(item.id, units + 1)}>+</button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="addon-total">
        <span>Add-ons total</span>
        <strong>₹{calculateAddOnsTotal(items, selected)}</strong>
      </div>
    </div>
  );
}
