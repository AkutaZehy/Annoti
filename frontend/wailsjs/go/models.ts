export namespace main {
	
	export class ImportResult {
	    imported: number;
	    updated: number;
	    skipped: number;
	    checksumSame: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.imported = source["imported"];
	        this.updated = source["updated"];
	        this.skipped = source["skipped"];
	        this.checksumSame = source["checksumSame"];
	    }
	}

}

export namespace models {
	
	export class TextAnchor {
	    type: string;
	    start: number;
	    end: number;
	    exact: string;
	    prefix: string;
	    suffix: string;
	
	    static createFrom(source: any = {}) {
	        return new TextAnchor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.start = source["start"];
	        this.end = source["end"];
	        this.exact = source["exact"];
	        this.prefix = source["prefix"];
	        this.suffix = source["suffix"];
	    }
	}
	export class Annotation {
	    id: string;
	    documentId: string;
	    parentId?: string;
	    authorId: string;
	    authorName: string;
	    quote: string;
	    body: string;
	    anchor: TextAnchor;
	    color?: string;
	    resolved: boolean;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Annotation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.documentId = source["documentId"];
	        this.parentId = source["parentId"];
	        this.authorId = source["authorId"];
	        this.authorName = source["authorName"];
	        this.quote = source["quote"];
	        this.body = source["body"];
	        this.anchor = this.convertValues(source["anchor"], TextAnchor);
	        this.color = source["color"];
	        this.resolved = source["resolved"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Document {
	    id: string;
	    path: string;
	    name: string;
	    checksum: string;
	    size: number;
	    changed: boolean;
	    content: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Document(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.checksum = source["checksum"];
	        this.size = source["size"];
	        this.changed = source["changed"];
	        this.content = source["content"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

