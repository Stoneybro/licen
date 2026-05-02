const fs = require('fs');

const files = [
  './src/app/app/audit/page.tsx',
  './src/app/app/audit/tx/[txHash]/page.tsx',
  './src/app/app/audit/dataset/[datasetRoot]/page.tsx',
  './src/app/app/audit/job/[jobId]/page.tsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove the import from mock
    content = content.replace(/import \{.*?MOCK_JOBS.*?\} from "@\/lib\/mock";\n/g, '');
    content = content.replace(/import \{.*?MOCK_DATASETS.*?\} from "@\/lib\/mock";\n/g, '');
    content = content.replace(/import \{ MOCK_DATASETS, MOCK_JOBS, PURPOSES \} from "@\/lib\/mock";/g, 'import { PURPOSES } from "@/lib/mock";');
    content = content.replace(/import \{ MOCK_JOBS, MOCK_DATASETS \} from "@\/lib\/mock";/g, '');
    content = content.replace(/import \{ MOCK_JOBS \} from "@\/lib\/mock";/g, '');
    
    // Inject empty arrays after imports
    const injection = `\nconst MOCK_JOBS: any[] = [];\nconst MOCK_DATASETS: any[] = [];\n`;
    content = content.replace(/(import .*?\n)+/, match => match + injection);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Cleared mock data from: ' + file);
});
