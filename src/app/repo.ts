import { ProjectRepository, browserStorage } from '../persistence/storage';

export const storage = browserStorage();
export const repo = new ProjectRepository(storage);
