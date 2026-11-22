import { DataStore } from '../repositories/interfaces';
import { ActionService } from './ActionService';
import { AlternativeResourceService } from './AlternativeResourceService';
import { AuthService } from './AuthService';
import { BookService } from './BookService';
import { FineService } from './FineService';
import { LoanService } from './LoanService';
import { NotificationScheduler, NotificationService } from './NotificationService';
import { RenewalService } from './RenewalService';

export interface Services {
  store: DataStore;
  auth: AuthService;
  books: BookService;
  loans: LoanService;
  renewals: RenewalService;
  alternatives: AlternativeResourceService;
  actions: ActionService;
  notifications: NotificationService;
  fines: FineService;
  scheduler: NotificationScheduler;
}

export function createServices(store: DataStore): Services {
  const notifications = new NotificationService(store);
  const renewals = new RenewalService(store);
  return {
    store,
    auth: new AuthService(store.repos.users),
    books: new BookService(store),
    loans: new LoanService(store, notifications),
    renewals,
    alternatives: new AlternativeResourceService(store),
    actions: new ActionService(store, renewals),
    notifications,
    fines: new FineService(store),
    scheduler: new NotificationScheduler(notifications),
  };
}
