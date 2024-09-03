import inquirer from 'inquirer';
import { createObjectCsvWriter } from 'csv-writer';
import chalk from 'chalk';

const PAGE_LIMIT = 30;
let allLeadsData = [];

const getSelectedOptions = async () => {
  try {
    const answers = await inquirer.prompt([
      { type: 'input', message: 'Digite sua instância:', name: 'i' },
      { type: 'input', message: 'API Token:', name: 'token' },
    ]);

    return answers;
  } catch (error) {
    console.log('Unexpected Error.');
  }
};

const getNumberOfPages = async (i, token) => {
  try {
    const firstPageData = await fetch(
      `https://sprinthub-api-master.sprinthub.app/leadsadvanced?apitoken=${token}&i=${i}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: PAGE_LIMIT,
          query: '{total}',
          showArchived: false,
        }),
      }
    );
    const json = await firstPageData.json();
    const totalLeads = json.data.total;
    // console.log('totalLeads:', totalLeads);
    const numberOfPages = Math.ceil(totalLeads / PAGE_LIMIT);

    return numberOfPages;
  } catch (error) {
    console.log('Erro:', error);
  }
};

function removeSpecificFields(object, fieldsToRemove) {
  const result = { ...object };

  for (const field of fieldsToRemove) {
    if (result.hasOwnProperty(field)) {
      delete result[field];
    }
  }

  return result;
}

function stringifyObjectValues(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value];
      }
      return [key, JSON.stringify(value)];
    })
  );
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const generateCSV = async (allLeadsData) => {
  // console.log(allLeadsData[0], Object.keys(allLeadsData[0]));
  const headerKeys = Object.keys(allLeadsData[0]).map((actualKey) => ({
    id: actualKey,
    title: actualKey,
  }));
  // console.log('headerKeys:', headerKeys);

  const csvConfig = createObjectCsvWriter({
    path: 'output.csv',
    header: headerKeys,
  });

  try {
    await csvConfig.writeRecords(allLeadsData);
    setTimeout(
      () => console.log(chalk.greenBright('\nArquivo output.csv criado!')),
      1500
    );
  } catch (error) {
    console.log(error);
  }
};

const fetchAllPages = async () => {
  const { i, token } = await getSelectedOptions();
  const numberOfPages = await getNumberOfPages(i, token);
  // console.log('numberOfPages', numberOfPages);

  console.log('');

  try {
    for (let page = 0; page < numberOfPages; page++) {
      const actualPage = await fetch(
        `https://sprinthub-api-master.sprinthub.app/leadsadvanced?apitoken=${token}&i=${i}&allFields=1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: PAGE_LIMIT,
            page: page,
            showArchived: false,
          }),
        }
      );
      const json = await actualPage.json();
      const actualLeads = json.data.leads;

      const formatedActualLeads = actualLeads.map((actualLead) => {
        const cleanedLead = removeSpecificFields(actualLead, [
          'userAccess',
          'departmentAccess',
          'channelRestrictions',
          '_id',
          'thirdPartyData',
        ]);

        return stringifyObjectValues(cleanedLead);
      });

      // console.log('formatedActualLeads.length', formatedActualLeads.length);
      allLeadsData.push(...formatedActualLeads);
      // console.log('allLeadsData', formatedActualLeads.length);

      // Tempo entre requisições
      await timeout(650);
      console.log(
        chalk.yellowBright(
          `[${Math.round(((page + 1) / numberOfPages) * 100)}%] Página ${
            page + 1
          } extraída.`
        )
      );
    }

    generateCSV(allLeadsData);
  } catch (error) {
    console.log('Erro:', error);
  }
};
fetchAllPages();
