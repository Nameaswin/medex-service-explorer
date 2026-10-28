"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// ---------- 1. Data types ----------

type Id = string | number;
type Amount = string | number | null;

type WellnessOption = {
    id: Id;
    durationInMinutes: number;
    price: Amount;
    discount: Amount;
    discountType: string | null;
    serviceCharge: Amount;
    serviceChargeType: string | null;
};

type Service = {
    id: Id;
    title: string;
    slug: string;
    type: string;
    userId: Id;
    categoryId: Id | null;
    subCategoryId: Id | null;
    price: Amount;
    discount: Amount;
    discountType: string | null;
    serviceCharge: Amount;
    serviceChargeType: string | null;
    status: boolean;
    testAtHome: boolean;
    homeTestCharge: Amount;
    wellnessPricing: WellnessOption[];
};

type Category = {
    id: Id;
    title: string;
    slug: string;
    type: string;
    status: boolean;
    parentId: Id | null;
    children?: Category[];
};

type Provider = {
    id: Id;
    name: string;
    status: string;
    providerInformation: {
        companyName: string;
        currency: string;
        city?: { name: string } | null;
        country?: { name: string } | null;
        rating: number | null;
        reviewCount: number;
    };
};

type MedexData = {
    categories: Category[];
    providers: Provider[];
    services: Service[];
};

type PriceDetails = {
    finalPrice: number;
    originalPrice: number;
    hasDiscount: boolean;
    durationInMinutes?: number;
};

// ---------- 2. Price helpers ----------

function toAmount(value: Amount): number {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
}

function calculatePrice(
    price: Amount,
    discount: Amount,
    discountType: string | null,
    serviceCharge: Amount,
    serviceChargeType: string | null
): PriceDetails {
    const originalPrice = toAmount(price);
    const discountValue = toAmount(discount);

    const discountAmount =
        discountType === "percent"
            ? (originalPrice * discountValue) / 100
            : discountValue;

    const afterDiscount = Math.max(0, originalPrice - discountAmount);

    const chargeValue = toAmount(serviceCharge);

    const chargeAmount =
        serviceChargeType === "percent"
            ? (afterDiscount * chargeValue) / 100
            : chargeValue;

    return {
        originalPrice,
        finalPrice: afterDiscount + chargeAmount,
        hasDiscount: discountValue > 0,
    };
}

function getServicePrice(service: Service): PriceDetails | null {
    // Wellness services use their pricing options instead of service.price.
    if (service.type === "wellness") {
        const options = (service.wellnessPricing ?? [])
            .filter((option) => option.price !== null)
            .map((option) => ({
                ...calculatePrice(
                    option.price,
                    option.discount,
                    option.discountType,
                    option.serviceCharge,
                    option.serviceChargeType
                ),
                durationInMinutes: option.durationInMinutes,
            }))
            .sort((a, b) => a.finalPrice - b.finalPrice);

        return options[0] ?? null;
    }

    if (service.price === null) {
        return null;
    }

    return calculatePrice(
        service.price,
        service.discount,
        service.discountType,
        service.serviceCharge,
        service.serviceChargeType
    );
}

function formatPrice(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

function formatServiceType(type: string): string {
    const names: Record<string, string> = {
        package: "Package",
        lab_test: "Lab Test",
        wellness: "Wellness",
        service: "Service",
        insurance: "Insurance",
    };

    return names[type] ?? type.replaceAll("_", " ");
}

// ---------- 3. Page ----------

    function HomeContent() {
    const [data, setData] = useState<MedexData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
        new Set());
        const [providerSearch, setProviderSearch] = useState("");
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
        function updateUrl(updates: Record<string, string>) {
            const params = new URLSearchParams(searchParams.toString());

            Object.entries(updates).forEach(([key, value]) => {
                if (value) {
                    params.set(key, value);
                } else {
                    params.delete(key);
                }
            });

            const queryString = params.toString();
            const nextUrl = queryString
                ? `${pathname}?${queryString}`
                : pathname;

            router.push(nextUrl, { scroll: false });
        }

    const search = searchParams.get("search") ?? "";
    const selectedCategoryId = searchParams.get("category") ?? "";
    const selectedSubCategoryId = searchParams.get("subcategory") ?? "";
    const selectedTypes = searchParams.get("type")?.split(",").filter(Boolean) ?? [];
        const selectedProviderIds = searchParams.get("provider")?.split(",").filter(Boolean) ?? [];

    const requestedSort = searchParams.get("sort");
    const sortOrder = [
        "relevance",
        "price-asc",
        "price-desc",
        "rating",
    ].includes(requestedSort ?? "")
        ? requestedSort!
        : "relevance";

    // Fetch the data once when the page loads.
    useEffect(() => {
        async function fetchServices() {
            try {
                const response = await fetch("/api/services");

                if (!response.ok) {
                    throw new Error("Failed to fetch service data");
                }

                const result: MedexData = await response.json();
                setData(result);
            } catch {
                setError("Could not load MedEx data. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        fetchServices();
    }, []);

    // Turn nested categories into one searchable list.
    const categories = useMemo(() => {
        if (!data) return [];

        const flattened: Category[] = [];

        function visit(categoryList: Category[]) {
            for (const category of categoryList) {
                flattened.push(category);

                if (category.children) {
                    visit(category.children);
                }
            }
        }

        visit(data.categories);
        return flattened;
    }, [data]);

    // Match services to providers and keep eligible records.
    const providerGroups = useMemo(() => {
        if (!data) return [];

        const providerById = new Map(
            data.providers.map((provider) => [String(provider.id), provider])
        );

        const categoryById = new Map(
            categories.map((category) => [String(category.id), category])
        );

        const query = search.trim().toLowerCase();
        const selectedCategory = categories.find(
            (category) => String(category.id) === selectedCategoryId
        );

        const selectedSubCategory = categories.find(
            (category) => String(category.id) === selectedSubCategoryId
        );
        console.log("Selected category state:", selectedCategoryId);
        const matchingServices = data.services.filter((service) => {
            if (!service.status) return false;

            const provider = providerById.get(String(service.userId));

            if (!provider || provider.status !== "active") {
                return false;
            }
            if (
                selectedProviderIds.length > 0 &&
                !selectedProviderIds.includes(String(provider.id))
            ) {
                return false;
            }

            // If a service has a category, that category must be active.
            if (service.categoryId !== null) {
                const category = categoryById.get(String(service.categoryId));

                if (!category || !category.status) {
                    return false;
                }
            }
            if (
                selectedCategoryId &&
                String(service.categoryId) !== selectedCategoryId
            ) {
                return false;
            }
// Filter by selected subcategory.
            if (
                selectedSubCategoryId &&
                String(service.subCategoryId) !== selectedSubCategoryId
            ) {
                return false;
            }

            // Filter by selected service types.
            if (
                selectedTypes.length > 0 &&
                !selectedTypes.includes(service.type)
            ) {
                return false;
            }

// Apply the search filter after the other filters.
            if (!query) return true;
            const category = categoryById.get(String(service.categoryId));

            const searchableText = [
                service.title,
                provider.name,
                provider.providerInformation.city?.name ?? "",
                provider.providerInformation.country?.name ?? "",
                category?.title ?? "",
                formatServiceType(service.type),
            ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(query);
        });

        // Group matching services by provider.
        const groups = new Map<
            string,
            { provider: Provider; services: Service[] }
        >();

        for (const service of matchingServices) {
            const provider = providerById.get(String(service.userId));

            if (!provider) continue;

            const key = String(provider.id);

            if (!groups.has(key)) {
                groups.set(key, { provider, services: [] });
            }

            groups.get(key)!.services.push(service);
        }

        const sortedGroups = Array.from(groups.values());
        if (sortOrder === "price-asc" || sortOrder === "price-desc") {
            for (const group of sortedGroups) {
                group.services.sort((serviceA, serviceB) => {
                    const priceA = getServicePrice(serviceA)?.finalPrice ?? null;
                    const priceB = getServicePrice(serviceB)?.finalPrice ?? null;

                    // Services without a price go last.
                    if (priceA === null && priceB !== null) return 1;
                    if (priceA !== null && priceB === null) return -1;
                    if (priceA === null && priceB === null) return 0;

                    return sortOrder === "price-asc"
                        ? priceA! - priceB!
                        : priceB! - priceA!;
                });
            }
        }

        sortedGroups.sort((a, b) => {
            // Highest-rated providers first; unrated providers go last.
            if (sortOrder === "rating") {
                const ratingA = a.provider.providerInformation.rating;
                const ratingB = b.provider.providerInformation.rating;

                return (ratingB ?? -1) - (ratingA ?? -1);
            }

            if (sortOrder === "price-asc" || sortOrder === "price-desc") {
                const currencyA = a.provider.providerInformation.currency;
                const currencyB = b.provider.providerInformation.currency;

                // Never compare amounts in different currencies directly.
                if (currencyA !== currencyB) {
                    return currencyA.localeCompare(currencyB);
                }

                const pricesA = a.services
                    .map(getServicePrice)
                    .flatMap((price) => price ? [price.finalPrice] : []);

                const pricesB = b.services
                    .map(getServicePrice)
                    .flatMap((price) => price ? [price.finalPrice] : []);

                const providerPriceA = pricesA.length
                    ? (sortOrder === "price-asc" ? Math.min(...pricesA) : Math.max(...pricesA))
                    : null;

                const providerPriceB = pricesB.length
                    ? (sortOrder === "price-asc" ? Math.min(...pricesB) : Math.max(...pricesB))
                    : null;

                // Providers without priced services go last.
                if (providerPriceA === null && providerPriceB !== null) return 1;
                if (providerPriceA !== null && providerPriceB === null) return -1;
                if (providerPriceA === null && providerPriceB === null) {
                    return a.provider.name.localeCompare(b.provider.name);
                }

                const priceDifference = sortOrder === "price-asc"
                    ? providerPriceA! - providerPriceB!
                    : providerPriceB! - providerPriceA!;

                return priceDifference ||
                    a.provider.name.localeCompare(b.provider.name);
            }

            // Default relevance: more matching services first.
            return (
                b.services.length - a.services.length ||
                a.provider.name.localeCompare(b.provider.name)
            );
        });

        return sortedGroups;
    }, [
        data,
        categories,
        search,
        selectedCategoryId,
        selectedSubCategoryId,
        selectedTypes,
        selectedProviderIds,
        sortOrder,

    ]);

    function toggleProvider(providerId: Id) {
        const key = String(providerId);

        setExpandedProviders((previous) => {
            const next = new Set(previous);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    // ---------- 4. Loading and error states ----------

    if (loading) {
        return (
            <main>
                <h1>MedEx Service Explorer</h1>
                <p role="status">Loading services...</p>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main>
                <h1>MedEx Service Explorer</h1>
                <p role="alert">{error || "No data available."}</p>
                <button onClick={() => window.location.reload()}>
                    Try again
                </button>
            </main>
        );
    }

    // ---------- 5. Page display ----------

    const matchingServiceCount = providerGroups.reduce(
        (total, group) => total + group.services.length,
        0
    );

    return (
        <main>
            <header>
                <h1>MedEx Service Explorer</h1>
                <p>Discover and compare healthcare services.</p>
            </header>

            <section aria-labelledby="explore-heading">
                <h2 id="explore-heading">Explore services</h2>
                <label htmlFor="sort-order">Sort by</label>
                <select
                    id="sort-order"
                    value={sortOrder}
                    onChange={(event) => updateUrl({ sort: event.target.value })}
                >
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price: Low to high</option>
                    <option value="price-desc">Price: High to low</option>
                    <option value="rating">Rating</option>
                </select>

        <label htmlFor="service-search">Search services</label>
        <input
            id="service-search"
            type="search"
            placeholder="Search service, provider, category, or location..."
            value={search}
            onChange={(event) =>
                updateUrl({ search: event.target.value })
            }
        />

        <div>
            <label htmlFor="category-filter">Category</label>
            <select
                id="category-filter"
                value={selectedCategoryId}
                onChange={(event) => {
                    updateUrl({
                        category: event.target.value,
                        subcategory: "",
                    });
                }}
            >
                <option value="">All categories</option>

                {categories
                    .filter(
                        (category) =>
                            category.parentId == null && category.status
                    )
                    .map((category) => (
                        <option
                            key={String(category.id)}
                            value={String(category.id)}
                        >
                            {category.title}
                        </option>
                    ))}
            </select>
        </div>

        <div>
            <label htmlFor="subcategory-filter">Subcategory</label>
            <select
                id="subcategory-filter"
                value={selectedSubCategoryId}
                disabled={!selectedCategoryId}
                onChange={(event) =>
                    updateUrl({ subcategory: event.target.value })
                }
            >
                <option value="">All subcategories</option>

                {categories
                    .filter(
                        (category) =>
                            String(category.parentId) === selectedCategoryId &&
                            category.status
                    )
                    .map((category) => (
                        <option
                            key={String(category.id)}
                            value={String(category.id)}
                        >
                            {category.title}
                        </option>
                    ))}
            </select>
        </div>
                <div>
                    <fieldset>
                        <legend>Service Type</legend>

                        {[
                            { value: "package", label: "Package" },
                            { value: "lab_test", label: "Lab Test" },
                            { value: "wellness", label: "Wellness" },
                            { value: "service", label: "Service" },
                            { value: "insurance", label: "Insurance" },
                        ].map((type) => (
                            <label key={type.value} style={{ display: "block" }}>
                                <input
                                    type="checkbox"
                                    value={type.value}
                                    checked={selectedTypes.includes(type.value)}
                                    onChange={(event) => {
                                        const nextTypes = event.target.checked
                                            ? [...selectedTypes, type.value]
                                            : selectedTypes.filter(
                                                (selected) => selected !== type.value
                                            );

                                        updateUrl({
                                            type: nextTypes.join(","),
                                        });
                                    }}
                                />
                                {" "}{type.label}
                            </label>
                        ))}
                    </fieldset>

                    <fieldset>
                        <legend>Providers</legend>

                        <input
                            type="text"
                            placeholder="Search providers..."
                            value={providerSearch}
                            onChange={(event) =>
                                setProviderSearch(event.target.value)
                            }
                        />

                        {data?.providers
                            .filter((provider) => provider.status === "active")
                            .filter((provider) =>
                                provider.name
                                    .toLowerCase()
                                    .includes(providerSearch.toLowerCase())
                            )
                            .sort((a, b) =>
                                a.name.localeCompare(b.name)
                            )
                            .map((provider) => {
                                const providerId = String(provider.id);

                                return (
                                    <label
                                        key={providerId}
                                        style={{ display: "block" }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProviderIds.includes(
                                                providerId
                                            )}
                                            onChange={(event) => {
                                                const nextProviderIds =
                                                    event.target.checked
                                                        ? [
                                                            ...selectedProviderIds,
                                                            providerId,
                                                        ]
                                                        : selectedProviderIds.filter(
                                                            (id) => id !== providerId
                                                        );

                                                updateUrl({
                                                    provider: nextProviderIds.join(","),
                                                });
                                            }}
                                        />
                                        {" "}{provider.name}
                                    </label>
                                );
                            })}

                        {selectedProviderIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => updateUrl({ provider: "" })}
                            >
                                Clear providers
                            </button>
                        )}
                    </fieldset>
                </div>
                <p>
                    Showing {matchingServiceCount} services across{" "}
                    {providerGroups.length} providers
                </p>

                {providerGroups.length === 0 ? (
                    <section>
                        <h3>No services found</h3>
                        <p>Try another search term or clear your search.</p>
                        <button
                            onClick={() => updateUrl({ search: "" })}
                        >
                            Clear search
                        </button>                    </section>
                ) : (
                    <div>
                        {providerGroups.map(({ provider, services }) => {
                            const info = provider.providerInformation;
                            const providerId = String(provider.id);
                            const isExpanded = expandedProviders.has(providerId);
                            const visibleServices = isExpanded
                                ? services
                                : services.slice(0, 3);

                            const location = [
                                info.city?.name,
                                info.country?.name,
                            ]
                                .filter(Boolean)
                                .join(", ");

                            return (
                                <article
                                    key={providerId}
                                    style={{
                                        border: "1px solid #ddd",
                                        borderRadius: "12px",
                                        padding: "16px",
                                        margin: "16px 0",
                                    }}
                                >
                                    <header>
                                        <h3>{provider.name}</h3>

                                        <p>
                                            {info.rating !== null
                                                ? `★ ${info.rating.toFixed(1)}`
                                                : "No rating yet"}
                                            {info.reviewCount > 0 &&
                                                ` · ${info.reviewCount.toLocaleString()} reviews`}
                                        </p>

                                        <p>{location || "Location not provided"}</p>
                                        <p>Currency: {info.currency}</p>
                                    </header>

                                    <h4>Services ({services.length})</h4>

                                    {visibleServices.map((service) => {
                                        const price = getServicePrice(service);
                                        const category = categories.find(
                                            (item) =>
                                                String(item.id) === String(service.categoryId)
                                        );

                                        return (
                                            <section
                                                key={String(service.id)}
                                                style={{
                                                    borderTop: "1px solid #eee",
                                                    padding: "12px 0",
                                                }}
                                            >
                                                <h5>{service.title}</h5>

                                                <p>{formatServiceType(service.type)}</p>

                                                {category && <p>Category: {category.title}</p>}
                                                {(() => {
                                                    const subCategory = categories.find(
                                                        (item) => String(item.id) === String(service.subCategoryId)
                                                    );
                                                    return subCategory ? (
                                                        <p>Subcategory: {subCategory.title}</p>
                                                    ) : null;
                                                })()}

                                                {price ? (
                                                    <p>
                                                        {service.type === "wellness" ? "From " : ""}
                                                        <strong>
                                                            {formatPrice(price.finalPrice, info.currency)}
                                                        </strong>

                                                        {price.hasDiscount && (
                                                            <>
                                                                {" "}
                                                                <span
                                                                    style={{
                                                                        textDecoration: "line-through",
                                                                        color: "#666",
                                                                    }}
                                                                >
                                  {formatPrice(
                                      price.originalPrice,
                                      info.currency
                                  )}
                                </span>
                                                            </>
                                                        )}

                                                        {price.durationInMinutes !== undefined &&
                                                            ` · ${price.durationInMinutes} minutes`}
                                                    </p>
                                                ) : (
                                                    <p>Price not available</p>
                                                )}

                                                <p>
                                                    Home testing:{" "}
                                                    {service.testAtHome ? "Available" : "Not available"}
                                                </p>

                                                {service.testAtHome &&
                                                    service.homeTestCharge !== null && (
                                                        <p>
                                                            Home-testing charge:{" "}
                                                            {formatPrice(
                                                                toAmount(service.homeTestCharge),
                                                                info.currency
                                                            )}
                                                        </p>
                                                    )}
                                            </section>
                                        );
                                    })}

                                    {services.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => toggleProvider(provider.id)}
                                        >
                                            {isExpanded
                                                ? "Show fewer services"
                                                : `View all ${services.length} services`}
                                        </button>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
  }
export default function Home() {
    return (
        <Suspense
            fallback={
                <p role="status">
                    Loading MedEx Service Explorer...
                </p>
            }
        >
            <HomeContent />
        </Suspense>
    );
}