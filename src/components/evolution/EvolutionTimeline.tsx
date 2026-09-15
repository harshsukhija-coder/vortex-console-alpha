import { useState } from 'react';
import type { EvolutionTimelineProps } from './evolutionData';

export default function EvolutionTimeline({ milestones }: EvolutionTimelineProps) {
  const [expandedIndex, setExpandedIndex] = useState(milestones.length - 1);

  return (
    <div className="evolution-timeline">
      {milestones.map((milestone, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <article
            className={`evolution-milestone ${isExpanded ? 'expanded' : ''}`}
            key={`${milestone.date}-${milestone.title}`}
          >
            <div className="evolution-rail">
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <button
              type="button"
              className="evolution-milestone-button"
              aria-expanded={isExpanded}
              onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
            >
              <div className="evolution-milestone-meta">
                <span>{milestone.date}</span>
                <span className={`evolution-area ${milestone.area}`}>{milestone.eyebrow}</span>
              </div>
              <div className="evolution-milestone-copy">
                <div>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.summary}</p>
                </div>
                <span className="evolution-expand">{isExpanded ? '−' : '+'}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="evolution-shipped">
                {milestone.shipped.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
