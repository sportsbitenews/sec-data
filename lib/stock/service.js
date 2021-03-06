const _       = require('lodash');
const fs      = require('fs-extra');
const util    = require('../util.js');
const Promise = require('bluebird');

const domain = 'https://www.sec.gov';
const basePath = `${__dirname}/../../resources/stocks`;

const create = (stock) => {
  return ensureDirectories(stock.ticker)
    .then(() => save(stock));
};

const ensureDirectories = (ticker) => {
  const pathname = `${basePath}/${ticker}`;

  return fs.pathExists(pathname)
    .then((exists) => {
      if(exists === false) {
        return fs.ensureDir(pathname)
          .then(() => fs.ensureDir(`${pathname}/filings`))
          .then(() => fs.ensureDir(`${pathname}/files`))
      }
    });
};

const getStockFilepath = (ticker) => {
  return `${basePath}/${ticker}/stock.json`;
};

const save = (stock) => {
  const filepath = getStockFilepath(stock.ticker);
  return fs.writeJson(filepath, stock);
};

const remove = (stock) => {
  return fs.remove(`${basePath}/${stock.ticker}`);
};

const findByTicker = (ticker) => {
  const filepath = getStockFilepath(ticker);
  return fs.readJson(filepath);
};

const hasEmptyFilings = (ticker) => {
  return util.getFiles(`${basePath}/${ticker}/filings`)
    .then((files) => {
      return files.length === 0;
    })
    .catch((err) => {
      if(err.code === 'ENOENT') {
        return false;
      }
    });
};

const filterDownloadInstructions = _.curry((filterFilings, ticker, formType) => {
  return findByTicker(ticker)
    .then((stock) => {
      let filings = filterFilings(stock, formType);

      return _.map(filings, (filing) => {
        let filingUrl = `${domain}${filing.resources.files}`;
        let prefix = filing.type.replace('/', '');
        let destination = `stocks/${stock.ticker}/files/${prefix}_${filing.date}.xml`

        return { filingUrl, destination };
      });
    });
});

const filterInteractiveAnnualFilings = (stock, formType = '10-K') => {
  return _
    .chain(_.get(stock, 'filings.annual.filings.entries'))
    .filter(filing => filing.resources.view)
    .filter(filing => filing.type === formType)
    .value();
};

const filterInteractiveQuarterlyFilings = (stock, formType = '10-Q') => {
  return _
    .chain(_.get(stock, 'filings.quarterly.filings.entries'))
    .filter(filing => filing.resources.view)
    .filter(filing => filing.type === formType)
    .value();
};

const readFilings = (ticker, formType) => {
  return getFilingFilesByTicker(ticker)
    .then((files) => {
      if(!files) return null;

      if(formType) {
        files = files.filter((file) => {
          let filename = _.last(file.split('/'));
          return _.includes(filename, formType);
        });
      }

      return Promise.all(_.map(files, (file) => {
        return fs.readJson(`${tickerDir}/filings/${file}`);
      }));
    });
};

const getFilingFilesByTicker = (ticker) => {
  return findByTicker(ticker)
    .then((stock) => {
      if(stock) {
        tickerDir = `${__dirname}/../../resources/stocks/${stock.ticker}`;

        return util.getFiles(`${tickerDir}/filings`);
      }
    });
};

const getFilingTransmissionsBy = (ticker, prefix = '10-K') => {
  let tickerDir;

  return findByTicker(ticker)
    .then((stock) => {
      if(stock) {
        tickerDir = `${__dirname}/../../resources/stocks/${stock.ticker}`;

        return util.getFiles(`${tickerDir}/files`);
      }
    })
    .then((files) => {
      if(!files) return null;

      files = files.filter((file) => {
        let filename = _.last(file.split('/'));
        return _.includes(filename, prefix);
      });

      return _.map(files, (file) => {
        return {
          src: `${tickerDir}/files/${file}`,
          dest: `${tickerDir}/filings/${_.replace(file, '.xml', '.json')}`
        };
      });
    });
};

module.exports = {
  create,
  filterDownloadInstructions,
  filterInteractiveAnnualFilings,
  filterInteractiveQuarterlyFilings,
  findByTicker,
  getFilingTransmissionsBy,
  hasEmptyFilings,
  readFilings,
  remove,
  save,
};
