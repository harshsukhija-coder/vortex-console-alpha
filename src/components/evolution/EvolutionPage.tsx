import { useState } from 'react';
import EvolutionTimeline from './EvolutionTimeline';
import {
  currentCapabilities,
  evolutionMilestones,
  nextHorizons,
  type EvolutionArea,
} from './evolutionData';
import './EvolutionPage.css';

const filters: Array<{ value: 'all' | EvolutionArea; label: string }> = [
  { value: 'all', label: 'Entire journey' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'booking', label: 'Booking' },
  { value: 'operations', label: 'Operations' },
  { value: 'insights', label: 'Insights' },
];

export default function EvolutionPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | EvolutionArea>('all');
  const visibleMilestones = activeFilter === 'all'
    ? evolutionMilestones
    : evolutionMilestones.filter((milestone) => milestone.area === activeFilter);

  return (
    <div className="evolution-page">
      <section className="evolution-hero">
        <div className="evolution-orbit one" />
        <div className="evolution-orbit two" />
        <div className="evolution-hero-content">
          <span className="evolution-kicker"><i /> Built in public, one operation at a time</span>
          <h1>From an empty screen to the <em>nerve center</em> of a gaming lounge.</h1>
          <p>
            Vortex Console evolved through real operational problems. Every booking conflict,
            timer, payment, reading, and chart made the product sharper.
          </p>
          <div className="evolution-hero-actions">
            <button
              type="button"
              className="evolution-primary-action"
              onClick={() => document.getElementById('evolution-roadmap')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explore the build
            </button>
            <a href="#/login" className="evolution-secondary-action">Open the console</a>
          </div>
        </div>
        <div className="evolution-signal-card">
          <span>Current system</span>
          <strong>Operational</strong>
          <div className="evolution-signal-line"><i /></div>
          <small>React · TypeScript · API-driven</small>
        </div>
      </section>

      <section className="evolution-capabilities" aria-label="Current capabilities">
        {currentCapabilities.map((capability) => (
          <div key={capability.label}>
            <strong>{capability.value}</strong>
            <span>{capability.label}</span>
          </div>
        ))}
      </section>

      <section className="evolution-story" id="evolution-roadmap">
        <div className="evolution-section-heading">
          <div>
            <span>Repository-backed timeline</span>
            <h2>Fourteen days of focused evolution</h2>
          </div>
          <p>Milestones are based on the project history and features running in the current workspace.</p>
        </div>

        <div className="evolution-filters" aria-label="Filter milestones">
          {filters.map((filter) => (
            <button
              type="button"
              className={activeFilter === filter.value ? 'active' : ''}
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <EvolutionTimeline milestones={visibleMilestones} />
      </section>

      <section className="evolution-system">
        <div className="evolution-section-heading">
          <div>
            <span>How it works today</span>
            <h2>One connected operating loop</h2>
          </div>
        </div>
        <div className="evolution-system-flow">
          {['Discover', 'Book', 'Play', 'Extend', 'Settle', 'Learn'].map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="evolution-next">
        <div className="evolution-section-heading">
          <div>
            <span>Exploration, not commitment</span>
            <h2>Possible next horizons</h2>
          </div>
          <p>These ideas are intentionally marked as future directions, not shipped functionality.</p>
        </div>
        <div className="evolution-next-grid">
          {nextHorizons.map((horizon, index) => (
            <article key={horizon.title}>
              <span>0{index + 1}</span>
              <h3>{horizon.title}</h3>
              <p>{horizon.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="evolution-cta">
        <span>THE STORY IS STILL RUNNING</span>
        <h2>Built for the people operating the floor.</h2>
        <a href="#/login">Enter Vortex Console</a>
      </section>
    </div>
  );
}
