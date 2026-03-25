import langchain
import pkgutil
print("LANGCHAIN VERSION:", getattr(langchain, '__version__', 'unknown'))
print("LANGCHAIN PREFIX:", langchain.__path__)
print("MODULES:")
for importer, modname, ispkg in pkgutil.iter_modules(langchain.__path__):
    print(" -", modname)
try:
    from langchain.chains import create_retrieval_chain
    print("SUCCESS: create_retrieval_chain found!")
except Exception as e:
    print("ERROR importing create_retrieval_chain:", e)
