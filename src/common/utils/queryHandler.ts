import { Query, FilterQuery } from 'mongoose';
import { ParsedQs } from 'qs';

interface QueryString {
	page?: string;
	sort?: string;
	limit?: string;
	fields?: string;
	[key: string]: string | undefined;
}

export default class QueryHandler<T> {
	private query: Query<T[], T>;
	private queryString: QueryString;
	private excludedFields: string[];

	constructor(
		query: Query<T[], T>,
		queryString: ParsedQs,
		excludedFields: string[] = ['page', 'sort', 'limit', 'fields']
	) {
		this.query = query;
		this.queryString = Object.fromEntries(Object.entries(queryString).map(([key, value]) => [key, String(value)]));
		this.excludedFields = excludedFields;
	}
	filter(): QueryHandler<T> {
		const queryObj: Record<string, unknown> = { ...(this.queryString as QueryString) };
		this.excludedFields.forEach((el) => delete queryObj[el]);

		// Create a new object to hold the parsed query parameters
		const parsedQueryObj: Record<string, unknown> = {};

		// Parse query parameters
		for (const key in queryObj) {
			const keyValue = queryObj[key];
			if (typeof keyValue === 'string') {
				if (keyValue === 'true') {
					parsedQueryObj[key] = true;
				} else if (keyValue === 'false') {
					parsedQueryObj[key] = false;
				} else if (keyValue.includes(':')) {
					const [operator, value] = keyValue.split(':');

					// Convert operator to MongoDB operator
					const mongoOperator = `$${operator}`;

					// Parse value as a number if it's numeric, otherwise leave it as a string
					const parsedValue = isNaN(Number(value)) ? value : Number(value);

					// If the key already exists in parsedQueryObj, add the new operator to it, otherwise create a new object
					if (typeof parsedQueryObj[key] === 'object' && parsedQueryObj[key] !== null) {
						(parsedQueryObj[key] as Record<string, unknown>)[mongoOperator] = parsedValue;
					} else {
						parsedQueryObj[key] = { [mongoOperator]: parsedValue };
					}
				} else {
					// For other fields, use the key and value directly for the filter
					parsedQueryObj[key] = keyValue;
				}
			}
		}

		this.query = this.query.find(parsedQueryObj as FilterQuery<T>);
		return this;
	}
	sort(defaultSort: string = 'updatedAt'): QueryHandler<T> {
		const sortBy = this.queryString.sort ? this.queryString.sort.split(',').join(' ') : defaultSort;
		this.query = this.query.sort(sortBy);

		return this;
	}

	limitFields(defaultField: string = '-__v'): QueryHandler<T> {
		const fields = this.queryString.fields ? this.queryString.fields.split(',').join(' ') : defaultField;
		this.query = this.query.select(fields);

		return this;
	}

	paginate(defaultPage: number = 1, defaultLimit: number = 10): QueryHandler<T> {
		const page = parseInt(this.queryString.page || '') || defaultPage;
		const parsedLimit = parseInt(this.queryString.limit || '');

		const limit = parsedLimit > 100 ? defaultLimit : parsedLimit || defaultLimit;

		const skip = (page - 1) * limit;

		this.query = this.query.skip(skip).limit(limit);

		return this;
	}

	async execute(): Promise<T[]> {
		return await this.query;
	}
}
