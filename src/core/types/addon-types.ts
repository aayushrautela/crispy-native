export interface AddonManifest {
    id: string;
    name: string;
    version?: string;
    description?: string;
    icon?: string;
    background?: string;
    types?: string[];
    resources?: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
    catalogs?: {
        type: string;
        id: string;
        name?: string;
        extra?: (string | { name: string; isRequired?: boolean; options?: string[] })[];
        extraSupported?: string[]; // Added this based on AddonService usage
    }[];
}
