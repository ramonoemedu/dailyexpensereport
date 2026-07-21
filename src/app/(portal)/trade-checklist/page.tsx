'use client';

export default function TradeChecklistPage() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <iframe
        src="/tools/trade-checklist-calculator.html"
        title="Trade Checklist Calculator"
        className="h-[calc(100vh-140px)] w-full rounded-[10px] border border-stroke dark:border-dark-3"
      />
    </div>
  );
}
