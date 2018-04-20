/**
 * Proteus Naming System API
 */
import * as request from 'request';


export interface Name {
  category: string;
  code: string;
  description: string;
  status: string;
};

export interface FindNamesOptions {
  category?: string;
  all?: boolean;
};

export interface IClient {
  findNames(options: FindNamesOptions): Promise<Name[]>;
};

export interface ClientOptions {
  url: string;
  agentOptions?: any;
};

// Simplified HTTP client types to facilitate testing //
interface HttpClientOptions {
  uri: string;
  qs?: { [key: string]: string | undefined };
  headers?: { [key: string]: string | undefined };
  agentOptions?: any;
};

export class Client implements IClient {

  protected options: ClientOptions;

  constructor(options: string | ClientOptions) {
    if (typeof options === 'string') {
      options = { url: options };
    }
    this.options = options;

    // Useful for testing later!
    // if (options.httpClient) {
    //   this.httpClient = options.httpClient;
    // }
  };

  public async findNames(opts?: FindNamesOptions): Promise<Name[]> {
    const reqopts = this.getBaseOptions();
    reqopts.uri += '/rest/v1/name';

    if (!reqopts.qs) {
      reqopts.qs = {};
    }
    if (opts) {
      if (opts.category) {
        reqopts.qs.fullname = opts.category;
      }
      if (opts.all !== undefined) {
        reqopts.qs.all = String(opts.all);
      }
    }

    return new Promise<Name[]>((resolve, reject) => {
      request.get(reqopts, (err, res, body) => {
        if (err) {
          reject(err);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`PNS API request: ${reqopts.uri}, status: ${res.statusCode}`));
          return;
        }
        try {
          let data: any = JSON.parse(body);
          if (!Array.isArray(data)) {
            reject(`PNS API request: ${reqopts.uri}, unexpected response format`);
            return;
          }
          // TODO: JSON schema validate!
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  protected getBaseOptions(): HttpClientOptions {
    if (!this.options.url) {
      throw new Error('FORG API base URL not specified');
    }
    return {
      uri: this.options.url,
      qs: {},
      headers: {
        Accept: 'application/json',
      },
      agentOptions: this.options.agentOptions || {},
    };
  };
};
