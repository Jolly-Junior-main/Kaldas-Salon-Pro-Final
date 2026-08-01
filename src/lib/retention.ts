import { Customer, Visit, CustomerWithRetention, RetentionStatus } from '../types';

export function classifyCustomer(customer: Customer, usrVisits: Visit[], curTime = new Date()): CustomerWithRetention {
  const customerVisits = usrVisits
    .filter(v => v.customer_id === customer.id)
    .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

  const lastVisit = customerVisits[0];
  const lastVisitDate = lastVisit ? lastVisit.visit_date : undefined;

  let visitCountInLast30Days = 0;
  let visitCountIn30To60Days = 0;

  customerVisits.forEach(v => {
    const vDate = new Date(v.visit_date);
    const diffMs = curTime.getTime() - vDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 0 && diffDays <= 30) {
      visitCountInLast30Days++;
    } else if (diffDays > 30 && diffDays <= 60) {
      visitCountIn30To60Days++;
    }
  });

  let retentionStatus: RetentionStatus = 'At-Risk'; // default

  if (visitCountInLast30Days >= 2) {
    retentionStatus = 'Frequent';
  } else if (visitCountInLast30Days === 1 || visitCountIn30To60Days === 1) {
    retentionStatus = 'Occasional';
  } else {
    retentionStatus = 'At-Risk';
  }

  return {
    ...customer,
    retentionStatus,
    lastVisitDate,
    visitCountInLast30Days
  };
}
