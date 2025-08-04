using Microsoft.Extensions.Caching.Memory;

namespace CyberRiskApp.Services
{
    public interface ICacheService
    {
        Task<T> GetOrSetAsync<T>(string key, Func<Task<T>> getItem, TimeSpan? expiry = null);
        void Remove(string key);
        void RemoveByPattern(string pattern);
    }

    public class CacheService : ICacheService
    {
        private readonly IMemoryCache _cache;
        private readonly HashSet<string> _keys;
        private readonly object _lock = new object();

        public CacheService(IMemoryCache cache)
        {
            _cache = cache;
            _keys = new HashSet<string>();
        }

        public async Task<T> GetOrSetAsync<T>(string key, Func<Task<T>> getItem, TimeSpan? expiry = null)
        {
            if (_cache.TryGetValue(key, out T cachedValue))
            {
                return cachedValue;
            }

            var item = await getItem();
            
            var cacheEntryOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromMinutes(30),
                Priority = CacheItemPriority.High
            };

            _cache.Set(key, item, cacheEntryOptions);
            
            lock (_lock)
            {
                _keys.Add(key);
            }

            return item;
        }

        public void Remove(string key)
        {
            _cache.Remove(key);
            lock (_lock)
            {
                _keys.Remove(key);
            }
        }

        public void RemoveByPattern(string pattern)
        {
            lock (_lock)
            {
                var keysToRemove = _keys.Where(k => k.Contains(pattern)).ToList();
                foreach (var key in keysToRemove)
                {
                    _cache.Remove(key);
                    _keys.Remove(key);
                }
            }
        }
    }
}