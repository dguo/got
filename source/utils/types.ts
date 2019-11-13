import http = require('http');
import https = require('https');
import ResponseLike = require('responselike');
import PCancelable = require('p-cancelable');
import Keyv = require('keyv');
import {Readable as ReadableStream} from 'stream';
import {CookieJar} from 'tough-cookie';
import {StorageAdapter} from 'cacheable-request';
import {Except} from 'type-fest';
import CacheableLookup from 'cacheable-lookup';
import {Timings} from '@szmarczak/http-timer/dist';
import {Hooks} from '../known-hook-events';
import {GotError, HTTPError, MaxRedirectsError, ParseError} from '../errors';
import {isProxiedSymbol} from '../as-promise';
import {ProxyStream} from '../as-stream';

export type DeepPartial<T> = {
	[Key in keyof T]?: T[Key] extends Array<infer ArrayVal>
		? Array<DeepPartial<ArrayVal>>
		: T[Key] extends ReadonlyArray<infer ArrayVal>
			? ReadonlyArray<DeepPartial<ArrayVal>>
			: DeepPartial<T[Key]>
};

export type Method =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'HEAD'
	| 'DELETE'
	| 'OPTIONS'
	| 'TRACE'
	| 'get'
	| 'post'
	| 'put'
	| 'patch'
	| 'head'
	| 'delete'
	| 'options'
	| 'trace';

export type ErrorCode =
	| 'ETIMEDOUT'
	| 'ECONNRESET'
	| 'EADDRINUSE'
	| 'ECONNREFUSED'
	| 'EPIPE'
	| 'ENOTFOUND'
	| 'ENETUNREACH'
	| 'EAI_AGAIN';

export type ResponseType = 'json' | 'buffer' | 'text';

export type URLArgument = string | https.RequestOptions | URL;

export interface Response extends http.IncomingMessage {
	body: Buffer | string | any;
	statusCode: number;

	/**
	The remote IP address.

	Note: Not available when the response is cached. This is hopefully a temporary limitation, see [lukechilds/cacheable-request#86](https://github.com/lukechilds/cacheable-request/issues/86).
	*/
	ip: string;

	fromCache?: boolean;
	isFromCache?: boolean;
	req: http.ClientRequest;
	requestUrl: string;
	retryCount: number;
	timings: Timings;
	redirectUrls: string[];
	request: {
		options: NormalizedOptions;
	};
}

// TODO: The `ResponseLike` type should be properly fixed instead:
// https://github.com/sindresorhus/got/pull/827/files#r323633794
export interface ResponseObject extends ResponseLike {
	socket: {
		remoteAddress: string;
	};
}

export interface RetryObject {
	attemptCount: number;
	retryOptions: Required<RetryOptions>;
	error: Error | GotError | ParseError | HTTPError | MaxRedirectsError;
	computedValue: number;
}

export type RetryFunction = (retryObject: RetryObject) => number;

export type HandlerFunction = <T extends ProxyStream | CancelableRequest<Response>>(options: NormalizedOptions, next: (options: NormalizedOptions) => T) => T;

export interface DefaultRetryOptions {
	limit: number;
	methods: Method[];
	statusCodes: number[];
	errorCodes: ErrorCode[];
}

export interface RetryOptions extends Partial<DefaultRetryOptions> {
	calculateDelay?: RetryFunction;
	maxRetryAfter?: number;
}

export type RequestFunction = typeof https.request;

export interface AgentByProtocol {
	http?: http.Agent;
	https?: https.Agent;
}

export interface Delays {
	lookup?: number;
	connect?: number;
	secureConnect?: number;
	socket?: number;
	response?: number;
	send?: number;
	request?: number;
}

export type Headers = Record<string, string | string[] | undefined>;

export interface DefaultOptions {
	method: Method;
	retry: number | DefaultRetryOptions;
	headers: Headers;
	hooks: Hooks;
	decompress: boolean;
	throwHttpErrors: boolean;
	followRedirect: boolean;
	stream: boolean;
	cache: string | StorageAdapter | false;
	dnsCache: CacheableLookup | Map<string, string> | Keyv | false;
	useElectronNet: boolean;
	responseType: ResponseType;
	resolveBodyOnly: boolean;
	maxRedirects: number;
}

// The library overrides the type definition of `agent`, `host`, 'headers and `timeout`.
export interface Options extends DeepPartial<DefaultOptions>, Except<https.RequestOptions, 'agent' | 'timeout' | 'host' | 'headers'> {
	host?: string;
	body?: string | Buffer | ReadableStream;
	hostname?: string;
	path?: string;
	socketPath?: string;
	protocol?: string;
	href?: string;
	options?: Options;
	hooks?: Partial<Hooks>;
	decompress?: boolean;
	stream?: boolean;
	encoding?: BufferEncoding | null;
	method?: Method;
	retry?: number | RetryOptions;
	throwHttpErrors?: boolean;
	cookieJar?: CookieJar;
	ignoreInvalidCookies?: boolean;
	request?: RequestFunction;
	agent?: http.Agent | https.Agent | boolean | AgentByProtocol;
	cache?: string | StorageAdapter | false;
	headers?: Headers;
	responseType?: ResponseType;
	resolveBodyOnly?: boolean;
	followRedirect?: boolean;
	prefixUrl?: URL | string;
	timeout?: number | Delays;
	dnsCache?: CacheableLookup | Map<string, string> | Keyv | false;
	url?: URL | string;
	searchParams?: Record<string, string | number | boolean | null> | URLSearchParams | string;
	query?: Options['searchParams']; // Deprecated
	useElectronNet?: boolean;
	form?: Record<string, any>;
	json?: Record<string, any>;
	context?: {[key: string]: unknown};
	maxRedirects?: number;
	lookup?: CacheableLookup['lookup'];
}

export interface NormalizedOptions extends DefaultOptions, Except<Options, keyof DefaultOptions> {
	// Normalized Got options
	hooks: Required<Hooks>;
	timeout: Delays;
	dnsCache: CacheableLookup | false;
	retry: Required<RetryOptions>;
	readonly prefixUrl?: string;
	method: Method;

	// Normalized URL options
	protocol: string;
	hostname: string;
	host: string;
	hash: string;
	search: string | null;
	pathname: string;
	href: string;
	path: string;
	port?: number;
	username: string;
	password: string;
	auth?: string;
}

export interface ExtendOptions extends Options {
	handlers?: HandlerFunction[];
	mutableDefaults?: boolean;
}

export type ExtendedOptions = DefaultOptions & Options;

export interface Defaults {
	options?: DefaultOptions;
	handlers?: HandlerFunction[];
	mutableDefaults?: boolean;
}

export interface NormalizedDefaults {
	options: NormalizedOptions;
	handlers: HandlerFunction[];
	mutableDefaults: boolean;
}

export type URLOrOptions = URLArgument | (Options & {url: URLArgument});

export interface CancelableRequest<T extends http.IncomingMessage | Buffer | string | object> extends PCancelable<T> {
	[isProxiedSymbol]: boolean;
	on(name: string, listener: () => void): CancelableRequest<T>;
	json<TReturnType extends object>(): CancelableRequest<TReturnType>;
	buffer<TReturnType extends Buffer>(): CancelableRequest<TReturnType>;
	text<TReturnType extends string>(): CancelableRequest<TReturnType>;
}
