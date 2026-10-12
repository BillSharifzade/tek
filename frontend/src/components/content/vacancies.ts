// Вакансия страницы /vacancies (GET /content/vacancies; правятся в панели «Вакансии», исходные тексты — с tectj.com/company/jobs).

export interface Vacancy {
  id: string;
  dept: string;
  title: string;
  city: string;
  experience: string;
  schedule: string;
  salary: string;
  blocks: { title: string; items: string[] }[];
}
